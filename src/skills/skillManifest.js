export function parseSkillFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
        return {
            frontmatter: {},
            body: content,
        };
    }
    const [, yamlStr, body] = match;
    const frontmatter = {};
    yamlStr.split('\n').forEach((line) => {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1)
            return;
        const key = line.slice(0, colonIndex).trim();
        let value = line.slice(colonIndex + 1).trim();
        if (value.startsWith('[') && value.endsWith(']')) {
            const items = value
                .slice(1, -1)
                .split(',')
                .map((s) => s.trim().replace(/['"]/g, ''));
            frontmatter[key] = items;
        }
        else if (value === 'true') {
            frontmatter[key] = true;
        }
        else if (value === 'false') {
            frontmatter[key] = false;
        }
        else {
            frontmatter[key] = value.replace(/['"]/g, '');
        }
    });
    return { frontmatter, body };
}
export function validateSkillManifest(manifest) {
    const errors = [];
    if (!manifest.name) {
        errors.push('Skill name is required');
    }
    if (!manifest.description) {
        errors.push('Skill description is recommended');
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
