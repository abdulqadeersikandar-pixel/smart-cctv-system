import { store } from '../services/dataStore.js';

export async function listEvents(req, res) {
  const events = await store.listEvents(100);
  res.json({ events });
}

export async function createEvent(req, res) {
  const event = await store.createEvent(req.body);
  res.status(201).json({ event });
}
