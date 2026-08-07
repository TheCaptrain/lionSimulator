// simulation/entities/agent/dna.js

export const DNA_BLUEPRINT = {
    max_age:            { min: 0,   max: 100,  step: 1,   label: "Max Age" },
    color:              { min: 0,   max: 360,  step: 10,  label: "Color (Hue)" },
    kin_recogn:         { min: 1,   max: 180,  step: 5,   label: "Kin Recognition" },
    size:               { min: 0.2, max: 5.0,  step: 0.1, label: "Physical Size" },
    speed:              { min: 0.1, max: 5.0,  step: 0.1, label: "Movement Speed" },
    foodSizePreference: { min: -10, max: 100, step: 1,   label: "Min Food Size" },
    hungerThreshold:    { min: -10, max: 100, step: 1,   label: "Hunger Threshold" },
    agentVisionRange:   { min: 50,  max: 1000, step: 10,  label: "Agent Vision Range" },
    aggression:         { min: 0,   max: 1,    step: 0.01,label: "Aggression" },
    fleefullness:       { min: 0,   max: 1,    step: 0.01,label: "Fleefullness" },
    sensingRange:       { min: 0,   max: 1000, step: 5,   label: "Sensing Range" },
    metabolism:         { min: 0.5,   max: 1.5, step: 0.01,   label: "Sensing Range" }
};

const getRandomStepValue = (trait) => {
    const totalSteps = (trait.max - trait.min) / trait.step;
    const randomStep = Math.floor(Math.random() * (totalSteps + 1));
    return trait.min + (randomStep * trait.step);
};

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

const mutateTrait = (traitKey, parentValue) => {
    const trait = DNA_BLUEPRINT[traitKey];
    if (!trait) return parentValue;

    if (traitKey === 'color') {
        const MUTATION_CHANCE = 0.10; // 10% chance
        const SHOULD_MUTATE = Math.random() < MUTATION_CHANCE;
        
        if (!SHOULD_MUTATE) return parentValue;

        const direction = Math.random() < 0.5 ? -1 : 1;
        const newColor = parentValue + (direction * trait.step);
        return (newColor + 360) % 360;
    }

    const stepShift = Math.floor(Math.random() * 7) - 3; // -3 to +3 steps
    const mutatedValue = parentValue + (stepShift * trait.step);
    
    return clamp(mutatedValue, trait.min, trait.max);
};

export const createDNA = (parent = null) => {
    const dna = {};

    if (!parent) {
        for (const traitKey in DNA_BLUEPRINT) {
            dna[traitKey] = getRandomStepValue(DNA_BLUEPRINT[traitKey]);
        }
        return dna;
    }

    for (const traitKey in parent) {
        dna[traitKey] = mutateTrait(traitKey, parent[traitKey]);
    }

    return dna;
};