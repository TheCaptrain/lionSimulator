// simulation/entities/food/food_dna.js
export const FOOD_BLUEPRINT = {
    nutrition: { min: 10, max: 100, step: 1, label: "Energy Value" },
    growthRate: { min: 0.1, max: 1.2, step: 0.1, label: "Growth Speed" },
    maxSize: { min: 5, max: 30, step: 1, label: "Max Size" }
};