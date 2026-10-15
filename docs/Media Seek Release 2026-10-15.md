# Media seek: Desktop 1.6.16 / Tracker v535 Alpha

Source base e4e7dee3a. Desktop adds source-bound seek with Windows GSMTC capability, timeline and seek-range validation. Runtime validators accept seek. EFB/toolbar include the Classic skin, menu hierarchy, attenuation settings, wheel navigation and seek mode; Winamp position slider can seek. Updates remain additive for older browser clients.

The public browser sources and index remain unchanged. EFB media sources are pinned under ga-tracker-client/efb-media-source while browser approval is pending. The asset sync prefers these pinned sources; copy the approved shared media sources there when promoting later changes.

Local Node and browser tests cover validation, source binding, one seek on wheel release, slider preview, missing timeline, existing audio ducking, relay and direct EFB/toolbar paths with simulated native responses. Actual Windows GSMTC, Chrome/Apple Music, installer launch and in-place updater acceptance remain Windows field-test items; no claim of completed simulator or Windows acceptance. No Community-package update is needed: the panels load their media UI from the runtime. Runtime Stable stays unchanged.

Windows validation by the PC agent: 9 native media tests passed, including real PowerShell SeekTarget and Core Audio matching. Public runtime/installer/blockmap/metadata downloads independently checked on Windows. Running user session was not interrupted; installer execution, in-place update and audible seek remain field acceptance items. Local packaged Desktop updater dependency set and native helper inclusion verified before upload.
