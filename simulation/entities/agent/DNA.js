// simulation/entities/agent/dna.js

// The Blueprint defines the "Rules" for each trait.
// This is used by the UI to build sliders and the mutation logic to clamp values.
export const DNA_BLUEPRINT = {
    max_age:      { min: 0,   max: 100,  step: 1,   label: "Max Age" },
    color:      { min: 0,   max: 360,  step: 10,   label: "Color (Hue)" },
    kin_recogn: { min: 1,   max: 180,  step: 5,   label: "Kin Recognition" },
    size:       { min: 0.2, max: 5.0,  step: 0.1, label: "Physical Size" },
    speed:      { min: 0.1, max: 5.0,  step: 0.1, label: "Movement Speed" },
    foodSizePreference: { min: -10, max: 100, step: 1, label: "Min Food Size" },
    hungerThreshold: { min: -10, max: 100, step: 1, label: "Hunger Threshold" },
    agentVisionRange:     { min: 50,  max: 1000, step: 10,  label: "Agent Vision Range" },
    aggression: { min: 0,   max: 1,    step: 0.01,label: "Aggression" },
    fleefullness: { min: 0, max: 1, step: 0.01, label: "Fleefullness" },
    sensingRange: { min: 0, max: 1000, step: 5, label: "Sensing Range" }
};

export const createDNA = (parent = null) => {
    const offspringDNA = {};

    if (!parent) {
        // FOUNDER: Generate clean, stepped values from the start
        for (const key in DNA_BLUEPRINT) {
            const r = DNA_BLUEPRINT[key];
            // Calculate total possible steps in the range
            const totalSteps = (r.max - r.min) / r.step;
            // Pick a random step and multiply back
            const randomStep = (Math.random() * totalSteps + 0.5) | 0;
            offspringDNA[key] = r.min + (randomStep * r.step);
        }
        return offspringDNA;
    }

    // OFFSPRING: Mutate based on step increments
    for (const key in parent) {
        const r = DNA_BLUEPRINT[key];
        if (!r) continue;

        let v = parent[key];

        // 1. Determine mutation magnitude in "steps"
        const stepShift = (Math.random() * 6 - 3 + 0.5) | 0;
        v += stepShift * r.step;

        if (key === 'color') {
            v = (v + 360) % 360;
        } else {
            // 2. Fast Clamp
            if (v < r.min) v = r.min;
            else if (v > r.max) v = r.max;
        }

        offspringDNA[key] = v;
    }

    return offspringDNA;
};