import { FindOperator, ObjectLiteral, Repository } from 'typeorm';

type WhereClause<T extends ObjectLiteral> = Partial<Record<keyof T, unknown>>;

export class InMemoryTypeOrmRepository<T extends ObjectLiteral> {
  private readonly items = new Map<string, T>();

  constructor(private readonly idField: keyof T = 'id' as keyof T) {}

  create(entity: T): T {
    return { ...entity };
  }

  async save(entity: T): Promise<T> {
    const id = String(entity[this.idField]);
    this.items.set(id, { ...entity });
    return entity;
  }

  async findOne(options: { where: WhereClause<T> }): Promise<T | null> {
    return (
      Array.from(this.items.values()).find((item) =>
        this.matchesWhere(item, options.where),
      ) ?? null
    );
  }

  async find(options: {
    where?: WhereClause<T>;
    order?: Partial<Record<keyof T, 'ASC' | 'DESC'>>;
  }): Promise<T[]> {
    let results = Array.from(this.items.values()).filter((item) =>
      options.where ? this.matchesWhere(item, options.where) : true,
    );

    if (options.order) {
      const [field, direction] = Object.entries(options.order)[0] as [
        keyof T,
        'ASC' | 'DESC',
      ];
      results = [...results].sort((left, right) => {
        const a = String(left[field] ?? '');
        const b = String(right[field] ?? '');
        const cmp = a.localeCompare(b);
        return direction === 'DESC' ? -cmp : cmp;
      });
    }

    return results;
  }

  async update(
    criteria: WhereClause<T>,
    partial: Partial<T>,
  ): Promise<void> {
    for (const [id, item] of this.items.entries()) {
      if (this.matchesWhere(item, criteria)) {
        this.items.set(id, { ...item, ...partial });
      }
    }
  }

  async upsert(
    entity: T,
    conflictPaths: (keyof T)[],
  ): Promise<void> {
    const existing = Array.from(this.items.values()).find((item) =>
      conflictPaths.every((key) => item[key] === entity[key]),
    );
    if (existing) {
      const id = String(existing[this.idField]);
      this.items.set(id, { ...existing, ...entity });
      return;
    }
    await this.save(entity);
  }

  createQueryBuilder() {
    return {
      innerJoin: () => this.createQueryBuilder(),
      getMany: async () => Array.from(this.items.values()),
    };
  }

  asRepository(): Repository<T> {
    return this as unknown as Repository<T>;
  }

  seed(entity: Partial<T>): void {
    const id = entity[this.idField];
    if (id === undefined || id === null) {
      throw new Error(`seed() requires ${String(this.idField)}`);
    }
    this.items.set(String(id), { ...entity } as T);
  }

  getAll(): T[] {
    return Array.from(this.items.values());
  }

  private matchesWhere(item: T, where: WhereClause<T>): boolean {
    return Object.entries(where).every(([key, value]) =>
      this.matchesField(item[key as keyof T], value),
    );
  }

  private matchesField(itemValue: unknown, expected: unknown): boolean {
    if (expected instanceof FindOperator) {
      if (expected.type === 'in') {
        const values = Array.isArray(expected.value)
          ? expected.value
          : [expected.value];
        return values.includes(itemValue);
      }
      return itemValue === expected.value;
    }

    if (expected && typeof expected === 'object' && '_type' in expected) {
      const operator = expected as { _type: string; _value: unknown };
      if (operator._type === 'not') {
        return itemValue !== operator._value;
      }
      if (operator._type === 'in') {
        return (operator._value as unknown[]).includes(itemValue);
      }
    }

    return itemValue === expected;
  }
}
