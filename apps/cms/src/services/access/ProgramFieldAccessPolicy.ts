import type { FieldAccess } from 'payload'
import { UserRole } from '@/utils/user/UserRole'

/**
 * Field-level access rules for the Programs collection.
 *
 * Counterpart to {@link ProgramAccessPolicy} (which governs collection-level
 * read/create/update/delete): these gate individual fields. Kept separate from
 * the collection-level `Access` policies because `FieldAccess` and `Access` are
 * not interchangeable (`Access` may return a `Where`).
 */
export class ProgramFieldAccessPolicy {
  /**
   * Editable by admins (and above) only; creators see the field read-only.
   * Used for fields managed centrally, such as the geographic coverage/zones.
   */
  static adminOnly: FieldAccess = ({ req: { user } }) => UserRole.isAdmin(user)
}
