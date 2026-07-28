export interface Repository {
  close(): Promise<void>;
}

export type RepositoryFactory<TRepository extends Repository> = () => TRepository;
