import Link from "next/link";

export const backupRoute = "/setari/backup-si-restaurare";
export function RecoveryLink() {
  return <Link href={backupRoute}>Backup și restaurare · recuperare date locale</Link>;
}
