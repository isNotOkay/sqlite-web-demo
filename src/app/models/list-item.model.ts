import {RelationType} from '../enums/relation-type.enum';

export interface ListItem {
  id: string;
  relationType: RelationType;
  label: string;
  columns?: string[];
}
