import { Category } from '../entities/Category.js';

export interface ICategoryRepository {
  findAll(): Promise<Category[]>;
  findById(id: string): Promise<Category | null>;
  save(category: Category): Promise<Category>;
  delete(id: string): Promise<boolean>;
}
