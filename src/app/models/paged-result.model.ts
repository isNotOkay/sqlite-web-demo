import { Row } from './row.model';

export interface PagedResult<T = Row> {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: T[];
}
