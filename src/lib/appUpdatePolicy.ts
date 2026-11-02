export function requiresAppUpdate(installedBuild: string, requiredBuild: number | null): boolean {
  const installed = Number(installedBuild);
  return /^\d+$/.test(installedBuild) && Number.isSafeInteger(installed) && installed > 0
    && requiredBuild !== null && Number.isSafeInteger(requiredBuild)
    && requiredBuild > installed && requiredBuild <= 2100000000;
}