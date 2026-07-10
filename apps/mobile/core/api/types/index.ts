export type ApiResponseMeta = {
  requestId?: string;
};

export type Paginated<T> = {
  items: T[];
  cursor?: string;
  hasMore: boolean;
};
