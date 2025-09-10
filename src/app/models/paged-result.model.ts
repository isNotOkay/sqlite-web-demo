export interface PagedResult<T> {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: T[];
}
