export const CACHE_KEYS = {
  TRENDING_POSTS: (limit: number) => `trending_posts_${limit}`,
  BEST_BY_CATEGORY: (category: string) => `best_by_category_${category}`,
};
