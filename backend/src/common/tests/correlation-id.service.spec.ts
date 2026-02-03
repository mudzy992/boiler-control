import { CorrelationIdService } from '../correlation-id.service';

/**
 * Comprehensive test suite for CorrelationIdService with AsyncLocalStorage.
 * Tests verify proper context isolation, async propagation, and lifecycle management.
 */
describe('CorrelationIdService (AsyncLocalStorage)', () => {
  let service: CorrelationIdService;

  beforeEach(() => {
    service = new CorrelationIdService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Synchronous Context', () => {
    it('should set and retrieve runId synchronously', () => {
      const runId = 'test-run-123';
      service.setRunId(runId);
      const retrieved = service.getRunId();
      expect(retrieved).toBe(runId);
    });

    it('should return generated runId if no explicit value set', () => {
      const retrieved = service.getRunId();
      expect(retrieved).toBeDefined();
      expect(retrieved).toMatch(/^run_/);
    });

    it('should return correct store object', () => {
      const runId = 'sync-context-123';
      service.setRunId(runId);
      const store = service.getStore();
      expect(store).toEqual({ runId });
    });

    it('should update runId value when called multiple times', () => {
      service.setRunId('run-1');
      expect(service.getRunId()).toBe('run-1');

      service.setRunId('run-2');
      expect(service.getRunId()).toBe('run-2');

      service.setRunId('run-3');
      expect(service.getRunId()).toBe('run-3');
    });

    it('should generate unique runIds', () => {
      const id1 = service.generateRunId();
      const id2 = service.generateRunId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^run_/);
      expect(id2).toMatch(/^run_/);
    });
  });

  describe('Asynchronous Context', () => {
    it('should preserve runId across async operations', async () => {
      const runId = 'async-run-123';
      return new Promise<void>((resolve) => {
        service.setRunId(runId);
        setTimeout(() => {
          const retrieved = service.getRunId();
          expect(retrieved).toBe(runId);
          resolve();
        }, 10);
      });
    });

    it('should preserve runId across Promise chain', async () => {
      const runId = 'promise-chain-123';
      service.setRunId(runId);

      const result = await Promise.resolve()
        .then(() => service.getRunId())
        .then((id) => {
          expect(id).toBe(runId);
          return id;
        });

      expect(result).toBe(runId);
    });

    it('should execute async function with run context', async () => {
      const captured: string[] = [];

      const result = await service.createRunContext(
        'test async operation',
        async (runId) => {
          captured.push(runId);
          captured.push(service.getRunId());
          await Promise.resolve();
          captured.push(service.getRunId());
          return 'success';
        },
      );

      expect(result).toBe('success');
      expect(captured.length).toBe(3);
      expect(captured[0]).toBe(captured[1]);
      expect(captured[1]).toBe(captured[2]);
    });

    it('should execute sync function with run context', () => {
      const captured: string[] = [];

      const result = service.createRunContext(
        'test sync operation',
        (runId) => {
          captured.push(runId);
          captured.push(service.getRunId());
          return 'success';
        },
      );

      expect(result).toBe('success');
      expect(captured.length).toBe(2);
      expect(captured[0]).toBe(captured[1]);
    });

    it('should support wrapWithRunId for callback-based functions', () => {
      const runId = 'wrapped-callback-123';
      service.setRunId(runId);

      const captured: (string | undefined)[] = [];
      const callback = () => {
        captured.push(service.getRunId());
      };

      const wrapped = service.wrapWithRunId(callback);
      wrapped();

      expect(captured).toContain(runId);
    });
  });

  describe('Nested Contexts', () => {
    it('should support nested run contexts', async () => {
      const captured: string[] = [];

      await service.createRunContext('outer operation', async (outerRunId) => {
        captured.push(outerRunId);

        return service.createRunContext(
          'inner operation',
          (innerRunId) => {
            captured.push(innerRunId);
            return 'nested';
          },
        );
      });

      expect(captured.length).toBe(2);
      expect(captured[0]).not.toBe(captured[1]);
    });

    it('should support multiple levels of nesting', async () => {
      const captured: string[] = [];

      await service.createRunContext('level-1', async (runId1) => {
        captured.push(runId1);

        return service.createRunContext('level-2', async (runId2) => {
          captured.push(runId2);

          return service.createRunContext('level-3', (runId3) => {
            captured.push(runId3);
            return 'done';
          });
        });
      });

      expect(captured.length).toBe(3);
      expect(captured[0]).not.toBe(captured[1]);
      expect(captured[1]).not.toBe(captured[2]);
      expect(captured[0]).not.toBe(captured[2]);
    });

    it('should isolate parallel contexts from each other', async () => {
      const results: string[] = [];

      await Promise.all([
        service.createRunContext('parallel-1', async (runId) => {
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));
          results.push(runId);
        }),
        service.createRunContext('parallel-2', async (runId) => {
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));
          results.push(runId);
        }),
        service.createRunContext('parallel-3', async (runId) => {
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));
          results.push(runId);
        }),
      ]);

      expect(results.length).toBe(3);
      expect(new Set(results).size).toBe(3);
    });
  });

  describe('Error Handling', () => {
    it('should propagate errors from sync functions', () => {
      expect(() => {
        service.createRunContext('failing operation', (runId) => {
          throw new Error('Test error');
        });
      }).toThrow('Test error');
    });

    it('should propagate errors from async functions', async () => {
      await expect(
        service.createRunContext('async failing operation', async (runId) => {
          throw new Error('Async error');
        }),
      ).rejects.toThrow('Async error');
    });

    it('should handle synchronous errors in wrapped function', () => {
      service.setRunId('test-runId');

      const syncErrorFunc = () => {
        throw new Error('Sync error');
      };

      const wrapped = service.wrapWithRunId(syncErrorFunc);

      expect(() => wrapped()).toThrow('Sync error');
    });
  });

  describe('Concurrent Operations', () => {
    it('should not cross-contaminate runIds in concurrent requests', async () => {
      const results: string[] = [];

      const operations = Array.from({ length: 10 }, (_, i) =>
        service.createRunContext(`concurrent-${i}`, async (runId) => {
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 20));
          results.push(runId);
        }),
      );

      await Promise.all(operations);

      expect(results.length).toBe(10);
      expect(new Set(results).size).toBe(10);
    });

    it('should handle concurrent operations with nested contexts', async () => {
      const results: string[] = [];

      await Promise.all([
        service.createRunContext('root-a', async (runIdA) => {
          results.push(`root-a:${runIdA}`);
          return service.createRunContext('child-a', async (runIdChildA) => {
            results.push(`child-a:${runIdChildA}`);
          });
        }),
        service.createRunContext('root-b', async (runIdB) => {
          results.push(`root-b:${runIdB}`);
          return service.createRunContext('child-b', async (runIdChildB) => {
            results.push(`child-b:${runIdChildB}`);
          });
        }),
      ]);

      expect(results.length).toBe(4);
      expect(results.some((r) => r.startsWith('root-a'))).toBe(true);
      expect(results.some((r) => r.startsWith('root-b'))).toBe(true);
      expect(results.some((r) => r.startsWith('child-a'))).toBe(true);
      expect(results.some((r) => r.startsWith('child-b'))).toBe(true);
    });
  });

  describe('Context Lifecycle', () => {
    it('should generate new context on each createRunContext call', async () => {
      const contexts: string[] = [];

      await service.createRunContext('operation-1', (runId) => {
        contexts.push(runId);
      });

      await service.createRunContext('operation-2', (runId) => {
        contexts.push(runId);
      });

      await service.createRunContext('operation-3', (runId) => {
        contexts.push(runId);
      });

      expect(contexts.length).toBe(3);
      expect(new Set(contexts).size).toBe(3);
    });

    it('should handle getStore() outside of context', () => {
      const store = service.getStore();
      expect(store).toBeUndefined();
    });

    it('should handle getStore() inside context', async () => {
      let capturedStore: any = null;

      await service.createRunContext('test operation', (runId) => {
        capturedStore = service.getStore();
      });

      expect(capturedStore).toBeDefined();
      expect(capturedStore?.runId).toBeDefined();
      expect(capturedStore.runId).toMatch(/^run_/);
    });
  });

  describe('Integration Patterns', () => {
    it('should support sequential operations with different contexts', async () => {
      const operations = [
        { label: 'operation-1' },
        { label: 'operation-2' },
        { label: 'operation-3' },
      ];
      const results: string[] = [];

      for (const op of operations) {
        await service.createRunContext(op.label, (runId) => {
          results.push(runId);
        });
      }

      expect(results.length).toBe(3);
      expect(new Set(results).size).toBe(3);
    });

    it('should support wrapped callback execution', () => {
      const runId = 'wrapped-callback-integration';
      service.setRunId(runId);

      const captured: string[] = [];
      const callback = () => {
        captured.push(service.getRunId());
        return 'result';
      };

      const wrapped = service.wrapWithRunId(callback);
      const result = wrapped();

      expect(result).toBe('result');
      expect(captured).toContain(runId);
    });

    it('should support method wrapping for object methods', () => {
      service.setRunId('method-wrap-123');

      class TestClass {
        getValue() {
          return service.getRunId();
        }
      }

      const instance = new TestClass();
      const wrapped = service.wrapWithRunId(() => instance.getValue());

      const result = wrapped();
      expect(result).toBe('method-wrap-123');
    });

    it('should clear runId when requested', () => {
      const runId = 'clear-test-123';
      service.setRunId(runId);

      expect(service.getRunId()).toBe(runId);

      service.clearRunId();

      const store = service.getStore();
      expect(store?.runId).toBe('');
    });
  });
});
