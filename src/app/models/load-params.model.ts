import {RelationType} from '../enums/relation-type.enum';

export interface LoadParams {
  id: string;
  kind: RelationType;
  pageIndex: number;
  pageSize: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}
