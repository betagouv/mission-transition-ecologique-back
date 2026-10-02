import * as migration_20260922_140459_initial from './20260922_140459_initial';
import * as migration_20260925_092558_payload_3_90 from './20260925_092558_payload_3_90';
import * as migration_20260925_131616_program_temporarily_unavailable from './20260925_131616_program_temporarily_unavailable';

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
    name: '20260925_131616_program_temporarily_unavailable'
  },
];
