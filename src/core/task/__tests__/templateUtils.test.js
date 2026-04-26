import { describe, expect, it } from 'vitest';
import { getTemplateInputFields, resolveTemplateInput, validateTemplateInput } from '../templateUtils';
describe('templateUtils', () => {
    const template = {
        id: 'template-1',
        name: 'Find vendors',
        description: 'Search {{product}} vendors in {{city}}',
        inputSchema: {
            prompt: 'Prompt',
            product: {
                label: 'Product',
                placeholder: 'coffee beans',
                required: true,
            },
            city: 'City',
            note: {
                label: 'Note',
                required: false,
            },
        },
        defaultInput: {
            prompt: 'Search {{product}} vendors in {{city}}',
            product: 'coffee',
            city: 'shenzhen',
        },
        executionProfile: 'browser-first',
        createdAt: 1,
        updatedAt: 1,
    };
    it('normalizes template input fields', () => {
        const fields = getTemplateInputFields(template);
        expect(fields).toEqual([
            {
                key: 'product',
                type: 'string',
                label: 'Product',
                placeholder: 'coffee beans',
                required: true,
                defaultValue: 'coffee',
            },
            {
                key: 'city',
                type: 'string',
                label: 'City',
                placeholder: undefined,
                required: true,
                defaultValue: 'shenzhen',
            },
            {
                key: 'note',
                type: 'string',
                label: 'Note',
                placeholder: undefined,
                required: false,
                defaultValue: '',
            },
        ]);
    });
    it('validates required template inputs', () => {
        const result = validateTemplateInput(template, {
            prompt: 'Search {{product}} vendors in {{city}}',
            product: 'tea',
            city: '',
        });
        expect(result.valid).toBe(false);
        expect(result.missingFields).toContain('city');
    });
    it('resolves prompt placeholders with merged input', () => {
        const result = resolveTemplateInput(template, {
            product: 'tea',
            city: 'hangzhou',
        });
        expect(result.prompt).toBe('Search tea vendors in hangzhou');
        expect(result.params.product).toBe('tea');
        expect(result.params.city).toBe('hangzhou');
    });
});
