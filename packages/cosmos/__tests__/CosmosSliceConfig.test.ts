import {
  CosmosSliceConfig,
  createDefaultCosmosConfig,
} from '../src/CosmosSliceConfig';

describe('CosmosSliceConfig', () => {
  describe('createDefaultCosmosConfig', () => {
    it('should return default configuration', () => {
      const config = createDefaultCosmosConfig();

      expect(config).toEqual({
        pointSizeScale: 1.1,
        scalePointsOnZoom: true,
        simulationGravity: 0.25,
        simulationRepulsion: 1.0,
        simulationLinkSpring: 1.0,
        simulationLinkDistance: 10,
        simulationFriction: 0.85,
        simulationDecay: 1000,
        renderLinks: true,
        linkArrows: false,
        curvedLinks: false,
        linkWidthScale: 1,
        linkArrowsSizeScale: 1,
      });
    });

    it('should return a new object each time', () => {
      const config1 = createDefaultCosmosConfig();
      const config2 = createDefaultCosmosConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('CosmosSliceConfig schema', () => {
    it('should validate correct configuration', () => {
      const config = {
        pointSizeScale: 1.5,
        scalePointsOnZoom: true,
        simulationGravity: 0.3,
        simulationRepulsion: 1.2,
        simulationLinkSpring: 1.1,
        simulationLinkDistance: 15,
        simulationFriction: 0.9,
        simulationDecay: 1500,
        renderLinks: true,
        linkArrows: true,
        curvedLinks: true,
        linkWidthScale: 1.2,
        linkArrowsSizeScale: 1.5,
      };

      const result = CosmosSliceConfig.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject invalid types', () => {
      const config = {
        pointSizeScale: '1.5', // should be number
        scalePointsOnZoom: true,
        simulationGravity: 0.3,
        simulationRepulsion: 1.2,
        simulationLinkSpring: 1.1,
        simulationLinkDistance: 15,
        simulationFriction: 0.9,
        simulationDecay: 1500,
        renderLinks: true,
        linkArrows: true,
        curvedLinks: true,
        linkWidthScale: 1.2,
        linkArrowsSizeScale: 1.5,
      };

      const result = CosmosSliceConfig.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should handle edge case values', () => {
      const config = {
        pointSizeScale: 0.1,
        scalePointsOnZoom: false,
        simulationGravity: 0,
        simulationRepulsion: 0,
        simulationLinkSpring: 0,
        simulationLinkDistance: 0,
        simulationFriction: 0,
        simulationDecay: 0,
        renderLinks: false,
        linkArrows: false,
        curvedLinks: false,
        linkWidthScale: 0,
        linkArrowsSizeScale: 0,
      };

      const result = CosmosSliceConfig.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should validate large values', () => {
      const config = {
        pointSizeScale: 100,
        scalePointsOnZoom: true,
        simulationGravity: 10,
        simulationRepulsion: 50,
        simulationLinkSpring: 20,
        simulationLinkDistance: 1000,
        simulationFriction: 1,
        simulationDecay: 10000,
        renderLinks: true,
        linkArrows: true,
        curvedLinks: true,
        linkWidthScale: 10,
        linkArrowsSizeScale: 10,
      };

      const result = CosmosSliceConfig.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const config = {
        pointSizeScale: 1.5,
        // Missing other required fields
      };

      const result = CosmosSliceConfig.safeParse(config);
      expect(result.success).toBe(false);
    });
  });
});