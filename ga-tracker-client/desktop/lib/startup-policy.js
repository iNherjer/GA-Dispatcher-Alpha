function startupDecision(settings = {}, hasCredentials = false) {
  return {
    showWindow: !hasCredentials || settings.startMinimized !== true,
    startTracker: Boolean(hasCredentials && settings.autoStartTracker !== false)
  };
}

module.exports = { startupDecision };
