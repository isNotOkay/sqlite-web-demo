import {RelationType} from '../enums/relation-type.enum';

export interface LoadParams {
  id: string;
  relationType: RelationType;
  pageIndex: number;
  pageSize: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}
