import semver from 'semver';
import fs from 'fs/promises';
import { ToolsFile } from './toolValidator';

// Version compatibility information
export interface VersionCompatibility {
    version: string;
    compatible: boolean;
    reason?: string;
    migration?: VersionMigration;
}

// Version migration information
export interface VersionMigration {
    fromVersion: string;
    toVersion: string;
    changes: VersionChange[];
    autoMigrate: boolean;
    migrationScript?: string;
}

// Individual version change
export interface VersionChange {
    type: 'added' | 'removed' | 'modified' | 'deprecated';
    component: 'tool' | 'parameter' | 'schema';
    name: string;
    description: string;
    impact: 'breaking' | 'minor' | 'patch';
}

// Version information
export interface VersionInfo {
    current: string;
    supported: string[];
    deprecated: string[];
    minVersion: string;
    maxVersion: string;
    changelog: VersionChange[];
}

/**
 * Tool Version Manager for handling schema versions and migrations
 */
export class ToolVersionManager {
    private readonly SUPPORTED_VERSIONS = ['1.0.0', '1.1.0', '1.2.0'];
    private readonly MIN_VERSION = '1.0.0';
    private readonly MAX_VERSION = '1.2.0';
    private readonly CURRENT_VERSION = '1.2.0';

    constructor() {
        console.log('📦 Tool Version Manager initialized');
        console.log(`   Current Version: ${this.CURRENT_VERSION}`);
        console.log(`   Supported Versions: ${this.SUPPORTED_VERSIONS.join(', ')}`);
    }

    /**
     * Check version compatibility
     */
    checkCompatibility(version: string): VersionCompatibility {
        console.log(`🔍 Checking compatibility for version: ${version}`);

        // Validate version format
        if (!semver.valid(version)) {
            return {
                version,
                compatible: false,
                reason: 'Invalid version format. Must follow semantic versioning (e.g., 1.0.0)',
            };
        }

        // Check if version is supported
        if (!this.SUPPORTED_VERSIONS.includes(version)) {
            const isNewer = semver.gt(version, this.MAX_VERSION);
            const isOlder = semver.lt(version, this.MIN_VERSION);

            if (isNewer) {
                return {
                    version,
                    compatible: false,
                    reason: `Version ${version} is newer than maximum supported version ${this.MAX_VERSION}`,
                };
            }

            if (isOlder) {
                return {
                    version,
                    compatible: false,
                    reason: `Version ${version} is older than minimum supported version ${this.MIN_VERSION}`,
                    migration: this.createMigrationPlan(version, this.MIN_VERSION),
                };
            }

            return {
                version,
                compatible: false,
                reason: `Version ${version} is not in the list of supported versions`,
            };
        }

        // Version is supported
        const migration = version !== this.CURRENT_VERSION
            ? this.createMigrationPlan(version, this.CURRENT_VERSION)
            : undefined;

        return {
            version,
            compatible: true,
            migration,
        };
    }

    /**
     * Create migration plan between versions
     */
    private createMigrationPlan(fromVersion: string, toVersion: string): VersionMigration {
        const changes = this.getChangesBetweenVersions(fromVersion, toVersion);
        const hasBreakingChanges = changes.some(change => change.impact === 'breaking');

        return {
            fromVersion,
            toVersion,
            changes,
            autoMigrate: !hasBreakingChanges,
            migrationScript: hasBreakingChanges ? `migrate_${fromVersion}_to_${toVersion}.js` : undefined,
        };
    }

    /**
     * Get changes between two versions
     */
    private getChangesBetweenVersions(fromVersion: string, toVersion: string): VersionChange[] {
        const changes: VersionChange[] = [];

        // Define version history and changes
        const versionChanges: Record<string, VersionChange[]> = {
            '1.0.0': [], // Initial version
            '1.1.0': [
                {
                    type: 'added',
                    component: 'tool',
                    name: 'arrangeObjectsInGrid',
                    description: 'Added grid arrangement functionality',
                    impact: 'minor',
                },
                {
                    type: 'added',
                    component: 'parameter',
                    name: 'spacing',
                    description: 'Added spacing parameter to layout tools',
                    impact: 'minor',
                },
                {
                    type: 'modified',
                    component: 'parameter',
                    name: 'color',
                    description: 'Enhanced color parameter to support hex, rgb, and named colors',
                    impact: 'patch',
                },
            ],
            '1.2.0': [
                {
                    type: 'added',
                    component: 'tool',
                    name: 'createShapePattern',
                    description: 'Added pattern creation tool for complex layouts',
                    impact: 'minor',
                },
                {
                    type: 'added',
                    component: 'tool',
                    name: 'copyObjects',
                    description: 'Added object copying functionality',
                    impact: 'minor',
                },
                {
                    type: 'modified',
                    component: 'schema',
                    name: 'parameters',
                    description: 'Enhanced parameter validation with better error messages',
                    impact: 'patch',
                },
                {
                    type: 'deprecated',
                    component: 'parameter',
                    name: 'strokeWidth',
                    description: 'strokeWidth parameter is deprecated, use borderWidth instead',
                    impact: 'minor',
                },
            ],
        };

        // Collect all changes from fromVersion to toVersion
        const fromVersionIndex = this.SUPPORTED_VERSIONS.indexOf(fromVersion);
        const toVersionIndex = this.SUPPORTED_VERSIONS.indexOf(toVersion);

        if (fromVersionIndex !== -1 && toVersionIndex !== -1) {
            const startIndex = Math.min(fromVersionIndex, toVersionIndex);
            const endIndex = Math.max(fromVersionIndex, toVersionIndex);

            for (let i = startIndex + 1; i <= endIndex; i++) {
                const version = this.SUPPORTED_VERSIONS[i];
                if (versionChanges[version]) {
                    changes.push(...versionChanges[version]);
                }
            }
        }

        return changes;
    }

    /**
     * Get version information
     */
    getVersionInfo(): VersionInfo {
        return {
            current: this.CURRENT_VERSION,
            supported: [...this.SUPPORTED_VERSIONS],
            deprecated: [], // No deprecated versions yet
            minVersion: this.MIN_VERSION,
            maxVersion: this.MAX_VERSION,
            changelog: this.getAllChanges(),
        };
    }

    /**
     * Get all changes across versions
     */
    private getAllChanges(): VersionChange[] {
        const allChanges: VersionChange[] = [];

        for (const version of this.SUPPORTED_VERSIONS) {
            if (version !== '1.0.0') { // Skip initial version
                const changes = this.getChangesBetweenVersions('1.0.0', version);
                allChanges.push(...changes);
            }
        }

        return allChanges;
    }

    /**
     * Validate tools file version
     */
    validateToolsVersion(toolsFile: ToolsFile): {
        valid: boolean;
        compatibility: VersionCompatibility;
        recommendedActions: string[];
    } {
        const version = toolsFile.version || '1.0.0';
        const compatibility = this.checkCompatibility(version);
        const recommendedActions: string[] = [];

        if (!compatibility.compatible) {
            recommendedActions.push(`Update tools file to supported version (${this.SUPPORTED_VERSIONS.join(', ')})`);

            if (compatibility.migration) {
                if (compatibility.migration.autoMigrate) {
                    recommendedActions.push('Run automatic migration to update schema');
                } else {
                    recommendedActions.push('Manual migration required due to breaking changes');
                }
            }
        } else if (version !== this.CURRENT_VERSION) {
            recommendedActions.push(`Consider upgrading to latest version (${this.CURRENT_VERSION}) for new features`);

            if (compatibility.migration) {
                const newFeatures = compatibility.migration.changes
                    .filter(change => change.type === 'added')
                    .map(change => change.name);

                if (newFeatures.length > 0) {
                    recommendedActions.push(`New features available: ${newFeatures.join(', ')}`);
                }
            }
        }

        return {
            valid: compatibility.compatible,
            compatibility,
            recommendedActions,
        };
    }

    /**
     * Upgrade tools file to target version
     */
    async upgradeToolsFile(
        inputPath: string,
        outputPath: string,
        targetVersion: string = this.CURRENT_VERSION
    ): Promise<{
        success: boolean;
        fromVersion: string;
        toVersion: string;
        changes: VersionChange[];
        error?: string;
    }> {
        try {
            console.log(`🔄 Upgrading tools file from ${inputPath} to version ${targetVersion}`);

            // Read and parse current file
            const fileContent = await fs.readFile(inputPath, 'utf-8');
            const toolsFile: ToolsFile = JSON.parse(fileContent);

            const currentVersion = toolsFile.version || '1.0.0';
            const compatibility = this.checkCompatibility(targetVersion);

            if (!compatibility.compatible) {
                return {
                    success: false,
                    fromVersion: currentVersion,
                    toVersion: targetVersion,
                    changes: [],
                    error: compatibility.reason,
                };
            }

            // Create migration plan
            const migration = this.createMigrationPlan(currentVersion, targetVersion);

            if (!migration.autoMigrate) {
                return {
                    success: false,
                    fromVersion: currentVersion,
                    toVersion: targetVersion,
                    changes: migration.changes,
                    error: 'Manual migration required due to breaking changes',
                };
            }

            // Apply automatic migrations
            const upgradedToolsFile = await this.applyMigrations(toolsFile, migration);

            // Write upgraded file
            await fs.writeFile(outputPath, JSON.stringify(upgradedToolsFile, null, 2));

            console.log(`✅ Successfully upgraded tools file to version ${targetVersion}`);
            console.log(`   Applied ${migration.changes.length} changes`);

            return {
                success: true,
                fromVersion: currentVersion,
                toVersion: targetVersion,
                changes: migration.changes,
            };

        } catch (error) {
            const errorMessage = `Failed to upgrade tools file: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error('❌', errorMessage);

            return {
                success: false,
                fromVersion: 'unknown',
                toVersion: targetVersion,
                changes: [],
                error: errorMessage,
            };
        }
    }

    /**
     * Apply automatic migrations to tools file
     */
    private async applyMigrations(toolsFile: ToolsFile, migration: VersionMigration): Promise<ToolsFile> {
        const upgradedFile = JSON.parse(JSON.stringify(toolsFile)); // Deep clone

        // Update version
        upgradedFile.version = migration.toVersion;

        // Update metadata
        if (!upgradedFile.metadata) {
            upgradedFile.metadata = {};
        }

        upgradedFile.metadata.updated = new Date().toISOString();
        upgradedFile.metadata.totalTools = upgradedFile.ai_canvas_tools.length;

        // Apply specific migrations based on changes
        for (const change of migration.changes) {
            if (change.type === 'deprecated' && change.component === 'parameter') {
                // Handle parameter deprecations
                if (change.name === 'strokeWidth') {
                    // Replace strokeWidth with borderWidth in all tools
                    for (const tool of upgradedFile.ai_canvas_tools) {
                        const params = tool.function.parameters.properties;
                        if (params.strokeWidth) {
                            params.borderWidth = {
                                ...params.strokeWidth,
                                description: params.strokeWidth.description?.replace('stroke', 'border') || 'Border width in pixels',
                            };
                            delete params.strokeWidth;

                            // Update required array if needed
                            if (tool.function.parameters.required) {
                                const requiredIndex = tool.function.parameters.required.indexOf('strokeWidth');
                                if (requiredIndex !== -1) {
                                    tool.function.parameters.required[requiredIndex] = 'borderWidth';
                                }
                            }
                        }
                    }
                }
            }
        }

        return upgradedFile;
    }

    /**
     * Generate version compatibility report
     */
    generateCompatibilityReport(_toolsFiles: string[]): Promise<{
        compatible: string[];
        incompatible: { file: string; reason: string }[];
        needsUpgrade: { file: string; currentVersion: string; recommendedVersion: string }[];
    }> {
        // This would be implemented to check multiple files
        // For now, return a placeholder
        return Promise.resolve({
            compatible: [],
            incompatible: [],
            needsUpgrade: [],
        });
    }
}

// Export singleton instance
export const toolVersionManager = new ToolVersionManager();
export default toolVersionManager;
