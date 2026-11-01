// Profile creation must survive camera/gallery app switches, including when no
// input has focus. Check this again after the update request finishes.
export function canApplyMobileUpdate(pathname: string, typing: boolean, hidden: boolean) {
  return !hidden && !typing && !/^\/restaurant\/profile\/?$/.test(pathname);
}