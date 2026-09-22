import * as migration_20260922_140459_initial from './20260922_140459_initial';

export const migrations = [
  {
    up: migration_20260922_140459_initial.up,
    down: migration_20260922_140459_initial.down,
    name: '20260922_140459_initial'
  },
];
