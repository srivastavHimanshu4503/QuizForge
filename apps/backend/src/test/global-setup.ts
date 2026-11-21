import { runMigrations } from '../db/migrate';

export default function setup() {
  runMigrations();
}
