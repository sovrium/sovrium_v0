# Developer Onboarding Guide

Welcome to the LaTeChforce Engine development team! This guide will help you get up to speed with our codebase, architecture, and development practices.

## 🚀 Quick Start (30 minutes)

### 1. Setup Development Environment

```bash
# Clone the repository
git clone https://github.com/omnera-dev/omnera.git
cd engine

# Install dependencies
bun install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Run tests to verify setup
bun test

# Start development server
bun run example
```

### 2. Explore the Codebase

```bash
# View the main structure
tree src -d -L 3

# Look at a complete feature
ls -la src/features/table/

# Check out the architecture documentation
cat docs/architecture/README.md
```

### 3. Generate Your First Feature

```bash
# Create a simple feature to understand the structure
bun run generate:feature learning --full

# Explore what was generated
ls -la src/features/learning/
```

## 📚 Essential Reading (1-2 hours)

### Core Architecture Documents
1. **[Architecture Overview](../architecture/README.md)** - Understanding the big picture
2. **[Feature Boundaries](../architecture/feature-boundaries.md)** - How features are organized
3. **[Event Flow](../architecture/event-flow.md)** - How features communicate
4. **[ADR-001: Domain Events](../architecture/adr-001-domain-events.md)** - Event-driven patterns

### Development Guides
1. **[Feature Development Guide](./feature-development.md)** - Step-by-step feature creation
2. **[Testing Strategies](./testing.md)** - How we test the codebase
3. **[Code Standards](./code-standards.md)** - Coding conventions and best practices

## 🏗️ Architecture Deep Dive (2-3 hours)

### Domain-Driven Design (DDD) Principles

Our architecture is built on DDD principles:

```typescript
// ✅ Good: Pure domain logic
export class Table {
  addRecord(record: Record): void {
    if (this.isLocked) {
      throw new Error('Cannot add record to locked table')
    }
    this.records.push(record)
    // Emit domain event
    this.events.push(new RecordAddedEvent(this.id, record))
  }
}

// ❌ Bad: Domain depending on infrastructure
export class Table {
  async addRecord(record: Record): Promise<void> {
    // Domain should not know about HTTP or databases
    await this.httpClient.post('/api/validate', record)
    await this.database.save(record)
  }
}
```

### Hexagonal Architecture

We follow hexagonal architecture with clear layer separation:

```
┌─────────────────────────────────────────┐
│                Interface                │
│     (Controllers, Routes, DTOs)         │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│              Application                │
│        (Use Cases, Services)            │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│               Domain                    │
│    (Entities, Value Objects, Events)    │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│            Infrastructure               │
│   (Repositories, External Services)     │
└─────────────────────────────────────────┘
```

### Feature-Based Organization

Each feature is self-contained:

```
src/features/table/
├── domain/           # Pure business logic
│   ├── entity/       # Domain entities
│   ├── value-object/ # Value objects
│   ├── event/        # Domain events
│   └── repository-interface/ # Repository contracts
├── application/      # Use cases and DTOs
│   ├── use-case/     # Business operations
│   └── dto/          # Data transfer objects
├── infrastructure/   # Data access and external services
│   ├── repository/   # Repository implementations
│   ├── service/      # External service adapters
│   └── factory.ts    # Dependency injection
└── interface/        # HTTP layer
    ├── controller/   # HTTP controllers
    └── routes.ts     # Route definitions
```

## 🧪 Testing Philosophy (1 hour)

### Testing Pyramid

We follow the testing pyramid with different types of tests:

```
    ┌─────────────┐
    │   E2E Tests │  ← Few, high-level user scenarios
    │   (Slow)    │
    └─────────────┘
         ┌─────────────────┐
         │Integration Tests│  ← API endpoints, use cases
         │   (Medium)      │
         └─────────────────┘
              ┌─────────────────────┐
              │    Unit Tests       │  ← Domain logic, pure functions
              │     (Fast)          │
              └─────────────────────┘
```

### Test Examples

```typescript
// Unit test - Testing domain logic
describe('Table', () => {
  it('should throw error when adding record to locked table', () => {
    const table = new Table(id, name, true) // locked = true
    const record = new Record(recordId, fields)

    expect(() => table.addRecord(record))
      .toThrow('Cannot add record to locked table')
  })
})

// Integration test - Testing use case
describe('CreateRecordUseCase', () => {
  it('should create record and emit event', async () => {
    const mockRepository = createMockRepository()
    const mockEventPublisher = createMockEventPublisher()
    const useCase = new CreateRecordUseCase(mockRepository, mockEventPublisher)

    await useCase.execute({ tableId: 1, fields: { name: 'Test' } })

    expect(mockEventPublisher.publish).toHaveBeenCalledWith(
      expect.any(RecordCreatedEvent)
    )
  })
})

// E2E test - Testing HTTP API
describe('Table API', () => {
  it('should create record via POST /tables/:id/records', async () => {
    const response = await request(app)
      .post('/tables/1/records')
      .send({ name: 'Test Record' })
      .expect(201)

    expect(response.body.data.name).toBe('Test Record')
  })
})
```

## 🔧 Development Tools (30 minutes)

### Code Generation

Generate features quickly:

```bash
# Full feature with all components
bun run generate:feature product --full

# Specific components only
bun run generate:feature notification --entity --repository --use-case

# View help for all options
bun run generate:feature --help
```

### Architecture Testing

Ensure architectural compliance:

```bash
# Run architecture tests
bun test test/architecture/

# Check for boundary violations
bun test test/architecture/architecture-rules.test.ts
```

### Code Quality Tools

```bash
# Linting and formatting
bun run lint      # ESLint with auto-fix
bun run format    # Prettier formatting

# Type checking
bunx tsc --noEmit

# Test coverage
bun test --coverage
```

## 💡 Common Patterns (1-2 hours)

### 1. Creating a New Entity

```typescript
// Step 1: Define value objects
export class ProductName {
  constructor(private readonly value: string) {
    if (value.length < 3) {
      throw new Error('Product name must be at least 3 characters')
    }
  }

  getValue(): string {
    return this.value
  }
}

// Step 2: Create the entity
export class Product {
  constructor(
    public readonly id: Id,
    public readonly name: ProductName,
    public readonly price: Money,
    public readonly createdAt: Date
  ) {}

  updatePrice(newPrice: Money): Product {
    return new Product(
      this.id,
      this.name,
      newPrice,
      this.createdAt
    )
  }
}
```

### 2. Implementing a Use Case

```typescript
export class CreateProductUseCase {
  constructor(
    private readonly productRepository: IProductRepository,
    private readonly eventPublisher: IDomainEventPublisher
  ) {}

  async execute(input: CreateProductInput): Promise<Product> {
    // 1. Validate business rules
    await this.validateBusinessRules(input)

    // 2. Create domain entity
    const product = new Product(
      new Id(0), // Will be assigned by repository
      new ProductName(input.name),
      new Money(input.price),
      new Date()
    )

    // 3. Persist
    const savedProduct = await this.productRepository.save(product)

    // 4. Emit domain event
    await this.eventPublisher.publish(
      new ProductCreatedEvent(savedProduct.id.toString(), {
        productId: savedProduct.id.getValue(),
        name: savedProduct.name.getValue(),
        price: savedProduct.price.getValue()
      })
    )

    return savedProduct
  }
}
```

### 3. Cross-Feature Communication

```typescript
// ✅ Good: Using domain events
export class OrderCreatedHandler implements IDomainEventHandler<OrderCreatedEvent> {
  constructor(private readonly inventoryService: IInventoryService) {}

  async handle(event: OrderCreatedEvent): Promise<void> {
    // React to order creation by updating inventory
    await this.inventoryService.reserveProducts(event.payload.productIds)
  }
}

// ❌ Bad: Direct feature imports
import { InventoryService } from '../inventory/application/service/inventory.service' // Don't do this!

export class CreateOrderUseCase {
  constructor(
    private readonly inventoryService: InventoryService // Tight coupling!
  ) {}
}
```

### 4. External Service Integration

```typescript
// Use anti-corruption layers for external services
export class PaymentAntiCorruptionLayer extends BaseAntiCorruptionLayer<
  StripePaymentResponse,
  PaymentResult
> {
  toDomain(external: StripePaymentResponse): PaymentResult {
    return new PaymentResult(
      new PaymentId(external.id),
      external.status === 'succeeded' ? PaymentStatus.Success : PaymentStatus.Failed,
      new Money(external.amount / 100), // Stripe uses cents
      new Date(external.created * 1000) // Stripe uses Unix timestamp
    )
  }

  toExternal(domain: PaymentResult): StripePaymentResponse {
    // Transform domain to Stripe format
  }
}
```

## 📋 Your First Task - Tutorial (1-2 hours)

Let's build a simple "Task" feature together:

### Step 1: Plan the Feature

**Domain**: Task Management
**Entities**: Task
**Value Objects**: TaskTitle, TaskStatus, Priority
**Events**: TaskCreated, TaskCompleted, TaskAssigned

### Step 2: Generate the Structure

```bash
bun run generate:feature task --full
```

### Step 3: Implement Value Objects

```typescript
// src/features/task/domain/value-object/task-status.value-object.ts
export class TaskStatus {
  private static readonly VALID_STATUSES = ['todo', 'in_progress', 'done'] as const

  constructor(private readonly value: typeof TaskStatus.VALID_STATUSES[number]) {
    if (!TaskStatus.VALID_STATUSES.includes(value)) {
      throw new Error(`Invalid task status: ${value}`)
    }
  }

  getValue(): string {
    return this.value
  }

  isCompleted(): boolean {
    return this.value === 'done'
  }
}
```

### Step 4: Enhance the Entity

```typescript
// src/features/task/domain/entity/task.entity.ts (modify generated file)
export class Task {
  constructor(
    public readonly id: Id,
    public readonly title: Name,
    public readonly status: TaskStatus,
    public readonly assigneeId: Id | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  complete(): Task {
    if (this.status.isCompleted()) {
      throw new Error('Task is already completed')
    }

    return new Task(
      this.id,
      this.title,
      new TaskStatus('done'),
      this.assigneeId,
      this.createdAt,
      new Date()
    )
  }

  assignTo(assigneeId: Id): Task {
    return new Task(
      this.id,
      this.title,
      this.status,
      assigneeId,
      this.createdAt,
      new Date()
    )
  }
}
```

### Step 5: Add Domain Events

```typescript
// src/features/task/domain/event/task-completed.event.ts
export class TaskCompletedEvent implements DomainEvent {
  public readonly aggregateType = 'task'
  public readonly eventType = 'task-completed'
  public readonly occurredOn: Date

  constructor(
    public readonly aggregateId: string,
    public readonly payload: {
      taskId: number
      title: string
      completedAt: Date
      assigneeId?: number
    }
  ) {
    this.occurredOn = new Date()
  }
}
```

### Step 6: Implement Use Case

```typescript
// src/features/task/application/use-case/complete-task.use-case.ts
export class CompleteTaskUseCase {
  constructor(
    private readonly taskRepository: ITaskRepository,
    private readonly eventPublisher: IDomainEventPublisher
  ) {}

  async execute(taskId: number): Promise<Task> {
    const task = await this.taskRepository.findById(new Id(taskId))
    if (!task) {
      throw new Error('Task not found')
    }

    const completedTask = task.complete()
    const savedTask = await this.taskRepository.save(completedTask)

    await this.eventPublisher.publish(
      new TaskCompletedEvent(savedTask.id.toString(), {
        taskId: savedTask.id.getValue(),
        title: savedTask.title.getValue(),
        completedAt: new Date(),
        assigneeId: savedTask.assigneeId?.getValue()
      })
    )

    return savedTask
  }
}
```

### Step 7: Write Tests

```typescript
// test/features/task/domain/entity/task.test.ts
describe('Task', () => {
  it('should complete a task', () => {
    const task = new Task(
      new Id(1),
      new Name('Test Task'),
      new TaskStatus('todo'),
      null,
      new Date(),
      new Date()
    )

    const completedTask = task.complete()

    expect(completedTask.status.isCompleted()).toBe(true)
  })

  it('should throw error when completing already completed task', () => {
    const task = new Task(
      new Id(1),
      new Name('Test Task'),
      new TaskStatus('done'),
      null,
      new Date(),
      new Date()
    )

    expect(() => task.complete()).toThrow('Task is already completed')
  })
})
```

### Step 8: Run Tests and Verify

```bash
# Run your tests
bun test test/features/task/

# Run architecture tests to ensure compliance
bun test test/architecture/

# Clean up the tutorial feature
rm -rf src/features/task
```

## 🎯 Next Steps

Now that you've completed the onboarding:

### Week 1 Goals
- [ ] Complete the tutorial task feature
- [ ] Read all essential documentation
- [ ] Set up your development environment
- [ ] Run the full test suite successfully
- [ ] Generate and explore a real feature you'll work on

### Week 2 Goals
- [ ] Implement your first real feature
- [ ] Write comprehensive tests
- [ ] Participate in code reviews
- [ ] Understand the deployment process
- [ ] Contribute to documentation improvements

### Ongoing Learning
- [ ] Follow our [code review guidelines](./code-review.md)
- [ ] Learn about [performance optimization](./performance.md)
- [ ] Understand [security best practices](./security.md)
- [ ] Explore [advanced patterns](./advanced-patterns.md)

## 🤝 Getting Help

### Resources
1. **Documentation**: Start with the docs in this repository
2. **Code Examples**: Look at existing features for patterns
3. **Architecture Tests**: Let the tests guide you on what's allowed
4. **Team Discussions**: Don't hesitate to ask questions

### Common Questions

**Q: Can I import from other features?**
A: No, use domain events for cross-feature communication.

**Q: Where should I put shared logic?**
A: In the shared domain (value objects, services) or create a shared kernel.

**Q: How do I handle external APIs?**
A: Use anti-corruption layers to protect your domain.

**Q: Should I write tests first?**
A: Yes, TDD is encouraged, especially for domain logic.

**Q: How do I handle database migrations?**
A: Check the database service documentation and existing migration examples.

## 🎉 Welcome to the Team!

You're now ready to contribute to the LaTeChforce Engine. Remember:

- **Domain First**: Always think about the business problem first
- **Events Over Imports**: Use domain events for loose coupling
- **Test Everything**: Our architecture tests will guide you
- **Document Changes**: Update docs when you change architecture
- **Ask Questions**: The team is here to help you succeed

Happy coding! 🚀

---

*Need help? Check our [FAQ](./faq.md) or reach out to the team.*
