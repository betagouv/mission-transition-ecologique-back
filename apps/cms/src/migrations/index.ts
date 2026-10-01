import * as migration_20260922_140459_initial from './20260922_140459_initial';
import * as migration_20260925_092558_payload_3_90 from './20260925_092558_payload_3_90';
import * as migration_20260925_131616_program_temporarily_unavailable from './20260925_131616_program_temporarily_unavailable';
import * as migration_20260928_150255_operator_groups_and_media from './20260928_150255_operator_groups_and_media';
import * as migration_20261001_082515_mixed_geographic_coverage from './20261001_082515_mixed_geographic_coverage';
import * as migration_20261001_092812_canonical_projects from './20261001_092812_canonical_projects';

export const migrations = [
  {
    up: migration_20260922_140459_initial.up,
    down: migration_20260922_140459_initial.down,
    name: '20260922_140459_initial',
  },
  {
    up: migration_20260925_092558_payload_3_90.up,
    down: migration_20260925_092558_payload_3_90.down,
    name: '20260925_092558_payload_3_90',
  },
  {
    up: migration_20260925_131616_program_temporarily_unavailable.up,
    down: migration_20260925_131616_program_temporarily_unavailable.down,
    name: '20260925_131616_program_temporarily_unavailable',
  },
  {
    up: migration_20260928_150255_operator_groups_and_media.up,
    down: migration_20260928_150255_operator_groups_and_media.down,
    name: '20260928_150255_operator_groups_and_media',
  },
  {
    up: migration_20261001_082515_mixed_geographic_coverage.up,
    down: migration_20261001_082515_mixed_geographic_coverage.down,
    name: '20261001_082515_mixed_geographic_coverage',
  },
  {
    up: migration_20261001_092812_canonical_projects.up,
    down: migration_20261001_092812_canonical_projects.down,
    name: '20261001_092812_canonical_projects'
  },
];
