/**
 * Data integrity utilities
 * Optimistic locking, versioning, soft deletes, constraints
 */

import { supabase } from './supabase'
import { errorLogger } from './errors'
import { logAudit } from './audit'

// ==========================================
// Optimistic Locking
// ==========================================

/**
 * Entity with version for optimistic locking
 */
export interface VersionedEntity {
  id: string
  updated_at: string
  version?: number
}

/**
 * Conflict error when optimistic lock fails
 */
export class OptimisticLockError extends Error {
  constructor(
    public entityType: string,
    public entityId: string,
    public serverVersion: any,
    public clientVersion: any
  ) {
    super(`Conflict: ${entityType} was modified by another user`)
    this.name = 'OptimisticLockError'
  }
}

/**
 * Update with optimistic locking
 * Returns the new data if successful, throws OptimisticLockError if conflict
 */
export async function updateWithLock<T extends VersionedEntity>(
  table: string,
  id: string,
  updates: Partial<T>,
  clientVersion: string,
  userId: string
): Promise<T> {
  // First, get the current server version
  const { data: current, error: fetchError } = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !current) {
    throw new Error(`Failed to fetch ${table} ${id}`)
  }

  // Check for conflict
  if (current.updated_at !== clientVersion) {
    throw new OptimisticLockError(table, id, current.updated_at, clientVersion)
  }

  // Perform the update
  const { data, error } = await supabase
    .from(table)
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('updated_at', clientVersion) // This is the actual lock check
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST204') {
      // Conflict - another user modified the record
      throw new OptimisticLockError(table, id, 'unknown', clientVersion)
    }
    throw error
  }

  logAudit(userId, 'UPDATE', table.toUpperCase() as any, id, current, data)

  return data
}

/**
 * Generic update with conflict resolution
 */
export async function updateWithConflictResolution<T extends VersionedEntity>(
  table: string,
  id: string,
  updates: Partial<T>,
  clientVersion: string,
  userId: string,
  onConflict: (server: T, client: Partial<T>) => Partial<T>
): Promise<T> {
  try {
    return await updateWithLock(table, id, updates, clientVersion, userId)
  } catch (error) {
    if (error instanceof OptimisticLockError) {
      // Fetch server version and merge
      const { data: server } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .single()

      if (!server) {
        throw new Error('Entity no longer exists')
      }

      // Let the caller resolve the conflict
      const resolved = onConflict(server, updates)
      return await updateWithLock(table, id, resolved, server.updated_at, userId)
    }
    throw error
  }
}

// ==========================================
// Soft Deletes
// ==========================================

export interface SoftDeletable {
  deleted_at: string | null
}

/**
 * Soft delete an entity
 */
export async function softDelete(
  table: string,
  id: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    errorLogger.error(`Soft delete failed for ${table}`, error)
    throw error
  }

  logAudit(userId, 'DELETE', table.toUpperCase() as any, id)
}

/**
 * Restore a soft-deleted entity
 */
export async function restore(
  table: string,
  id: string,
  userId: string
): Promise<void> {
  const { data: old, error: fetchError } = await supabase
    .from(table)
    .select('deleted_at')
    .eq('id', id)
    .single()

  if (fetchError || !old) {
    throw new Error('Entity not found')
  }

  const { error } = await supabase
    .from(table)
    .update({ deleted_at: null })
    .eq('id', id)

  if (error) {
    errorLogger.error(`Restore failed for ${table}`, error)
    throw error
  }

  logAudit(userId, 'UPDATE', table.toUpperCase() as any, id, { deleted_at: old.deleted_at }, { deleted_at: null })
}

/**
 * Query excluding soft-deleted items
 */
export function excludeDeleted(
  query: any
): any {
  return query.is('deleted_at', null)
}

// ==========================================
// Data Versioning / History
// ==========================================

export interface VersionHistoryEntry {
  id: string
  entity_type: string
  entity_id: string
  version_number: number
  old_values: Record<string, any>
  new_values: Record<string, any>
  changed_by: string
  changed_at: string
}

/**
 * Create a version history entry
 */
export async function createVersion(
  entityType: string,
  entityId: string,
  oldValues: Record<string, any>,
  newValues: Record<string, any>,
  userId: string
): Promise<void> {
  try {
    // Get the current max version number
    const { data: lastVersion } = await supabase
      .from('version_history')
      .select('version_number')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single()

    const nextVersion = lastVersion ? lastVersion.version_number + 1 : 1

    await supabase
      .from('version_history')
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        version_number: nextVersion,
        old_values: oldValues,
        new_values: newValues,
        changed_by: userId,
        changed_at: new Date().toISOString()
      })
  } catch (error) {
    // Don't fail the main operation if versioning fails
    errorLogger.error('Failed to create version history', error as Error)
  }
}

/**
 * Get version history for an entity
 */
export async function getVersionHistory(
  entityType: string,
  entityId: string,
  limit: number = 50
): Promise<VersionHistoryEntry[]> {
  const { data, error } = await supabase
    .from('version_history')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('version_number', { ascending: false })
    .limit(limit)

  if (error) {
    errorLogger.error('Failed to fetch version history', error)
    return []
  }

  return data || []
}

/**
 * Restore a specific version
 */
export async function restoreVersion(
  entityType: string,
  entityId: string,
  versionNumber: number,
  userId: string
): Promise<void> {
  // Get the version to restore
  const { data: version } = await supabase
    .from('version_history')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('version_number', versionNumber)
    .single()

  if (!version) {
    throw new Error('Version not found')
  }

  // Get current values for audit
  const { data: current } = await supabase
    .from(entityType.toLowerCase())
    .select('*')
    .eq('id', entityId)
    .single()

  // Restore the values from that version
  const { error } = await supabase
    .from(entityType.toLowerCase())
    .update(version.new_values)
    .eq('id', entityId)

  if (error) {
    errorLogger.error('Failed to restore version', error)
    throw error
  }

  // Create new version entry for the restore
  await createVersion(
    entityType,
    entityId,
    current || {},
    version.new_values,
    userId
  )
}

// ==========================================
// Validation & Constraints
// ==========================================

/**
 * Unique constraint check
 */
export async function checkUnique(
  table: string,
  column: string,
  value: string,
  excludeId?: string
): Promise<boolean> {
  let query = supabase
    .from(table)
    .select('id')
    .eq(column, value)
    .limit(1)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data, error } = await query

  if (error) {
    errorLogger.error('Unique check failed', error)
    return true // Assume unique on error to not block
  }

  return (data?.length || 0) === 0
}

/**
 * Validate data against schema
 */
export function validateData<T extends Record<string, any>>(
  data: T,
  schema: Record<keyof T, { type: string; required?: boolean; maxLength?: number }>
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  for (const [key, rules] of Object.entries(schema)) {
    const value = data[key]

    // Required check
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${key} is required`)
      continue
    }

    // Skip other validations if empty and not required
    if (value === undefined || value === null || value === '') {
      continue
    }

    // Type check
    if (rules.type === 'string' && typeof value !== 'string') {
      errors.push(`${key} must be a string`)
    } else if (rules.type === 'number' && typeof value !== 'number') {
      errors.push(`${key} must be a number`)
    } else if (rules.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`${key} must be a boolean`)
    }

    // Max length for strings
    if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
      errors.push(`${key} must be at most ${rules.maxLength} characters`)
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
