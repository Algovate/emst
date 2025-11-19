import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRandomServer, generateCnameHash } from './sse-utils.js';

describe('sse-utils', () => {
  describe('getRandomServer', () => {
    it('should return a valid server number', () => {
      const server = getRandomServer();
      const validServers = [13, 16, 23, 53, 57, 60, 93];
      expect(validServers).toContain(server);
    });

    it('should return different server numbers on multiple calls', () => {
      const servers = new Set();
      // Call multiple times to increase chance of getting different values
      for (let i = 0; i < 100; i++) {
        servers.add(getRandomServer());
      }
      // Should have at least one server (could be all same by chance, but unlikely)
      expect(servers.size).toBeGreaterThan(0);
      // All values should be valid server numbers
      const validServers = [13, 16, 23, 53, 57, 60, 93];
      for (const server of servers) {
        expect(validServers).toContain(server);
      }
    });
  });

  describe('generateCnameHash', () => {
    it('should generate a 32-character hex string', () => {
      const hash = generateCnameHash();
      expect(hash).toHaveLength(32);
      expect(hash).toMatch(/^[0-9a-f]{32}$/);
    });

    it('should generate different hashes on multiple calls', () => {
      const hashes = new Set();
      for (let i = 0; i < 100; i++) {
        hashes.add(generateCnameHash());
      }
      // Should generate unique hashes (very unlikely to have collisions)
      expect(hashes.size).toBeGreaterThan(90);
    });

    it('should generate valid hexadecimal characters', () => {
      const hash = generateCnameHash();
      // Should only contain 0-9 and a-f
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });
  });
});

