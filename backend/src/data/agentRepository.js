const { randomUUID } = require('crypto');
const { TERMINAL_STATUSES } = require('../constants/agentConstants');

const sessions = new Map();
const sessionsByItem = new Map();
const eventsBySession = new Map();

function cloneSession(session) {
  if (!session) {
    return null;
  }

  return JSON.parse(JSON.stringify(session));
}

function createSession(session) {
  const id = session.agentSessionId || randomUUID();
  const record = { ...session, agentSessionId: id };

  sessions.set(id, record);

  const forItem = sessionsByItem.get(record.itemId) || [];
  if (!forItem.includes(id)) {
    forItem.push(id);
  }
  sessionsByItem.set(record.itemId, forItem);

  eventsBySession.set(id, []);

  return cloneSession(record);
}

function findSessionById(id) {
  return cloneSession(sessions.get(id));
}

function findActiveSessionByItemId(itemId) {
  const ids = sessionsByItem.get(itemId) || [];

  for (let i = ids.length - 1; i >= 0; i -= 1) {
    const session = sessions.get(ids[i]);
    if (session && !TERMINAL_STATUSES.includes(session.currentStatus)) {
      return cloneSession(session);
    }
  }

  return null;
}

function updateSession(id, updates) {
  const existing = sessions.get(id);
  if (!existing) {
    return null;
  }

  const updated = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  sessions.set(id, updated);
  return cloneSession(updated);
}

function addEvent(sessionId, event) {
  const events = eventsBySession.get(sessionId);
  if (!events) {
    return null;
  }

  events.push(event);
  return { ...event };
}

function getEvents(sessionId) {
  const events = eventsBySession.get(sessionId);
  return events ? events.map((event) => ({ ...event })) : null;
}

function deleteSessionsForItem(itemId) {
  const ids = sessionsByItem.get(itemId) || [];
  ids.forEach((id) => {
    sessions.delete(id);
    eventsBySession.delete(id);
  });
  sessionsByItem.delete(itemId);
  return ids.length;
}

module.exports = {
  createSession,
  findSessionById,
  findActiveSessionByItemId,
  updateSession,
  addEvent,
  getEvents,
  deleteSessionsForItem
};
