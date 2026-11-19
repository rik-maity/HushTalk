
export async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex++;

        results[currentIndex] = await mapper(
          items[currentIndex]
        );
      }
    }
  );

  await Promise.all(workers);

  return results;
}
