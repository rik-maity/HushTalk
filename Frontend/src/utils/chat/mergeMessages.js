
export function mergeMessages(history, current) {
  const messagesById = new Map();

  [...history, ...current].forEach((message) => {
    const existing = messagesById.get(message.id);

    messagesById.set(message.id, {
      ...existing,
      ...message,
      reactions:
        message.reactions ?? existing?.reactions ?? [],
      receipts:
        message.receipts ?? existing?.receipts ?? []
    });
  });

  return [...messagesById.values()].sort(
    (a, b) =>
      new Date(a.createdAt) - new Date(b.createdAt)
  );
}
