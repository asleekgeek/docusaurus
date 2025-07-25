/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {jest} from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import {DEFAULT_PLUGIN_ID} from '@docusaurus/utils';
import cliDocs from '../cli';
import {
  getVersionDocsDirPath,
  getVersionsFilePath,
  getVersionSidebarsPath,
} from '../versions/files';
import type {PluginOptions} from '@docusaurus/plugin-content-docs';
import type {LoadContext} from '@docusaurus/types';

const {cliDocsVersionCommand} = cliDocs;

const fixtureDir = path.join(__dirname, '__fixtures__');

describe('docsVersion', () => {
  const simpleSiteDir = path.join(fixtureDir, 'simple-site');
  const versionedSiteDir = path.join(fixtureDir, 'versioned-site');
  const customI18nSiteDir = path.join(fixtureDir, 'site-with-custom-i18n-path');

  const DEFAULT_OPTIONS = {
    id: 'default',
    path: 'docs',
    sidebarPath: '',
    sidebarCollapsed: true,
    sidebarCollapsible: true,
  } as PluginOptions;

  it('no version tag provided', async () => {
    await expect(() =>
      cliDocsVersionCommand(null, DEFAULT_OPTIONS, {
        siteDir: simpleSiteDir,
      } as LoadContext),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Versions should be strings. Found type "object" for version null."`,
    );
    await expect(() =>
      cliDocsVersionCommand(undefined, DEFAULT_OPTIONS, {
        siteDir: simpleSiteDir,
      } as LoadContext),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Versions should be strings. Found type "undefined" for version undefined."`,
    );
    await expect(() =>
      cliDocsVersionCommand('', DEFAULT_OPTIONS, {
        siteDir: simpleSiteDir,
      } as LoadContext),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Invalid version name "": version name must contain at least one non-whitespace character."`,
    );
  });

  it('version tag should not have slash', async () => {
    await expect(() =>
      cliDocsVersionCommand('foo/bar', DEFAULT_OPTIONS, {
        siteDir: simpleSiteDir,
      } as LoadContext),
    ).rejects.toThrow(
      'Invalid version name "foo/bar": version name should not include slash (/) or backslash (\\).',
    );
    await expect(() =>
      cliDocsVersionCommand('foo\\bar', DEFAULT_OPTIONS, {
        siteDir: simpleSiteDir,
      } as LoadContext),
    ).rejects.toThrow(
      'Invalid version name "foo\\bar": version name should not include slash (/) or backslash (\\).',
    );
  });

  it('version tag should not be too long', async () => {
    await expect(() =>
      cliDocsVersionCommand('a'.repeat(255), DEFAULT_OPTIONS, {
        siteDir: simpleSiteDir,
      } as LoadContext),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Invalid version name "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": version name cannot be longer than 32 characters."`,
    );
  });

  it('version tag should not be a dot or two dots', async () => {
    await expect(() =>
      cliDocsVersionCommand('..', DEFAULT_OPTIONS, {
        siteDir: simpleSiteDir,
      } as LoadContext),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Invalid version name "..": version name should not be "." or ".."."`,
    );
    await expect(() =>
      cliDocsVersionCommand('.', DEFAULT_OPTIONS, {
        siteDir: simpleSiteDir,
      } as LoadContext),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Invalid version name ".": version name should not be "." or ".."."`,
    );
  });

  it('version tag should be a valid pathname', async () => {
    await expect(() =>
      cliDocsVersionCommand('<foo|bar>', DEFAULT_OPTIONS, {
        siteDir: simpleSiteDir,
      } as LoadContext),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Invalid version name "<foo|bar>": version name should be a valid file path."`,
    );
    await expect(() =>
      cliDocsVersionCommand('foo\x00bar', DEFAULT_OPTIONS, {
        siteDir: simpleSiteDir,
      } as LoadContext),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Invalid version name "foo bar": version name should be a valid file path."`,
    );
    await expect(() =>
      cliDocsVersionCommand('foo:bar', DEFAULT_OPTIONS, {
        siteDir: simpleSiteDir,
      } as LoadContext),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Invalid version name "foo:bar": version name should be a valid file path."`,
    );
  });

  it('version tag already exist', async () => {
    await expect(() =>
      cliDocsVersionCommand('1.0.0', DEFAULT_OPTIONS, {
        siteDir: versionedSiteDir,
      } as LoadContext),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"[docs]: this version already exists! Use a version tag that does not already exist."`,
    );
  });

  it('no docs file to version', async () => {
    const emptySiteDir = path.join(fixtureDir, 'empty-site');
    await expect(() =>
      cliDocsVersionCommand('1.0.0', DEFAULT_OPTIONS, {
        siteDir: emptySiteDir,
        i18n: {
          locales: ['en', 'zh-Hans'],
          defaultLocale: 'en',
          currentLocale: 'en',
          path: 'i18n',
          localeConfigs: {
            en: {path: 'en', translate: true},
            'zh-Hans': {path: 'zh-Hans', translate: true},
          },
        },
      } as unknown as LoadContext),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"[docs]: no docs found in "<PROJECT_ROOT>/packages/docusaurus-plugin-content-docs/src/__tests__/__fixtures__/empty-site/docs"."`,
    );
  });

  it('first time versioning', async () => {
    const copyMock = jest.spyOn(fs, 'copy').mockImplementation(() => {});
    const writeMock = jest.spyOn(fs, 'outputFile');
    let versionedSidebar!: unknown;
    let versionedSidebarPath!: string;
    writeMock.mockImplementationOnce((filepath, content: string) => {
      versionedSidebarPath = filepath;
      versionedSidebar = JSON.parse(content);
    });
    let versionsPath!: string;
    let versions!: unknown;
    writeMock.mockImplementationOnce((filepath, content: string) => {
      versionsPath = filepath;
      versions = JSON.parse(content);
    });
    const consoleMock = jest.spyOn(console, 'log').mockImplementation(() => {});
    const options = {
      ...DEFAULT_OPTIONS,
      sidebarPath: path.join(simpleSiteDir, 'sidebars.json'),
    };
    await cliDocsVersionCommand('1.0.0', options, {
      siteDir: simpleSiteDir,
      i18n: {
        locales: ['en', 'zh-Hans'],
        defaultLocale: 'en',
        currentLocale: 'en',
        path: 'i18n',
        localeConfigs: {
          en: {path: 'en', translate: true},
          'zh-Hans': {path: 'zh-Hans', translate: true},
        },
      },
    } as unknown as LoadContext);
    expect(copyMock).toHaveBeenCalledTimes(3);
    expect(copyMock).toHaveBeenCalledWith(
      path.join(simpleSiteDir, options.path),
      getVersionDocsDirPath(simpleSiteDir, DEFAULT_PLUGIN_ID, '1.0.0'),
    );
    expect(copyMock).toHaveBeenCalledWith(
      path.join(
        simpleSiteDir,
        'i18n/zh-Hans/docusaurus-plugin-content-docs/current',
      ),
      path.join(
        simpleSiteDir,
        'i18n/zh-Hans/docusaurus-plugin-content-docs/version-1.0.0',
      ),
    );
    expect(copyMock).toHaveBeenCalledWith(
      path.join(
        simpleSiteDir,
        'i18n/zh-Hans/docusaurus-plugin-content-docs/current.json',
      ),
      path.join(
        simpleSiteDir,
        'i18n/zh-Hans/docusaurus-plugin-content-docs/version-1.0.0.json',
      ),
    );
    expect(versionedSidebar).toMatchSnapshot();
    expect(versionedSidebarPath).toEqual(
      getVersionSidebarsPath(simpleSiteDir, DEFAULT_PLUGIN_ID, '1.0.0'),
    );
    expect(versionsPath).toEqual(
      getVersionsFilePath(simpleSiteDir, DEFAULT_PLUGIN_ID),
    );
    expect(versions).toEqual(['1.0.0']);
    expect(consoleMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /.*\[SUCCESS\].*\[docs\].*: version .*1\.0\.0.* created!.*/,
      ),
    );

    copyMock.mockRestore();
    writeMock.mockRestore();
    consoleMock.mockRestore();
  });

  it('works with custom i18n paths', async () => {
    const copyMock = jest.spyOn(fs, 'copy').mockImplementation(() => {});
    const writeMock = jest.spyOn(fs, 'outputFile');
    let versionedSidebar!: unknown;
    let versionedSidebarPath!: string;
    writeMock.mockImplementationOnce((filepath, content: string) => {
      versionedSidebarPath = filepath;
      versionedSidebar = JSON.parse(content);
    });
    let versionsPath!: string;
    let versions!: unknown;
    writeMock.mockImplementationOnce((filepath, content: string) => {
      versionsPath = filepath;
      versions = JSON.parse(content);
    });
    const consoleMock = jest.spyOn(console, 'log').mockImplementation(() => {});
    const options = {
      ...DEFAULT_OPTIONS,
      sidebarPath: path.join(customI18nSiteDir, 'sidebars.json'),
    };
    await cliDocsVersionCommand('1.0.0', options, {
      siteDir: customI18nSiteDir,
      i18n: {
        locales: ['en', 'zh-Hans'],
        defaultLocale: 'en',
        path: 'i18n-custom',
        localeConfigs: {
          en: {path: 'en-custom'},
          'zh-Hans': {path: 'zh-Hans-custom'},
        },
      },
    } as unknown as LoadContext);
    expect(copyMock).toHaveBeenCalledWith(
      path.join(customI18nSiteDir, options.path),
      getVersionDocsDirPath(customI18nSiteDir, DEFAULT_PLUGIN_ID, '1.0.0'),
    );
    expect(copyMock).toHaveBeenCalledWith(
      path.join(
        customI18nSiteDir,
        'i18n-custom/zh-Hans-custom/docusaurus-plugin-content-docs/current',
      ),
      path.join(
        customI18nSiteDir,
        'i18n-custom/zh-Hans-custom/docusaurus-plugin-content-docs/version-1.0.0',
      ),
    );
    expect(versionedSidebar).toMatchSnapshot();
    expect(versionedSidebarPath).toEqual(
      getVersionSidebarsPath(customI18nSiteDir, DEFAULT_PLUGIN_ID, '1.0.0'),
    );
    expect(versionsPath).toEqual(
      getVersionsFilePath(customI18nSiteDir, DEFAULT_PLUGIN_ID),
    );
    expect(versions).toEqual(['1.0.0']);
    expect(consoleMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /.*\[SUCCESS\].*\[docs\].*: version .*1\.0\.0.* created!.*/,
      ),
    );

    copyMock.mockRestore();
    writeMock.mockRestore();
    consoleMock.mockRestore();
  });

  it('not the first time versioning', async () => {
    const copyMock = jest.spyOn(fs, 'copy').mockImplementation(() => {});
    const writeMock = jest.spyOn(fs, 'outputFile');
    let versionedSidebar!: unknown;
    let versionedSidebarPath!: string;
    writeMock.mockImplementationOnce((filepath, content: string) => {
      versionedSidebarPath = filepath;
      versionedSidebar = JSON.parse(content);
    });
    let versionsPath!: string;
    let versions!: unknown;
    writeMock.mockImplementationOnce((filepath, content: string) => {
      versionsPath = filepath;
      versions = JSON.parse(content);
    });
    const consoleMock = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warnMock = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const options = {
      ...DEFAULT_OPTIONS,
      sidebarPath: path.join(versionedSiteDir, 'sidebars.json'),
    };
    await cliDocsVersionCommand('2.0.0', options, {
      siteDir: versionedSiteDir,
      i18n: {
        locales: ['en', 'zh-Hans'],
        defaultLocale: 'en',
        currentLocale: 'en',
        path: 'i18n',
        localeConfigs: {
          en: {path: 'en', translate: true},
          'zh-Hans': {path: 'zh-Hans', translate: true},
        },
      },
    } as unknown as LoadContext);
    expect(copyMock).toHaveBeenCalledWith(
      path.join(versionedSiteDir, options.path),
      getVersionDocsDirPath(versionedSiteDir, DEFAULT_PLUGIN_ID, '2.0.0'),
    );
    expect(versionedSidebar).toMatchSnapshot();
    expect(versionedSidebarPath).toEqual(
      getVersionSidebarsPath(versionedSiteDir, DEFAULT_PLUGIN_ID, '2.0.0'),
    );
    expect(versionsPath).toEqual(
      getVersionsFilePath(versionedSiteDir, DEFAULT_PLUGIN_ID),
    );
    expect(versions).toEqual(['2.0.0', '1.0.1', '1.0.0', 'withSlugs']);
    expect(consoleMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /.*\[SUCCESS\].*\[docs\].*: version .*2\.0\.0.* created!.*/,
      ),
    );
    expect(warnMock.mock.calls[0]![0]).toMatchInlineSnapshot(
      `"[WARNING] [docs]: no docs found in "<PROJECT_ROOT>/packages/docusaurus-plugin-content-docs/src/__tests__/__fixtures__/versioned-site/i18n/zh-Hans/docusaurus-plugin-content-docs/current". Skipping."`,
    );

    warnMock.mockRestore();
    copyMock.mockRestore();
    writeMock.mockRestore();
    consoleMock.mockRestore();
  });

  it('second docs instance versioning', async () => {
    const pluginId = 'community';

    const copyMock = jest.spyOn(fs, 'copy').mockImplementation(() => {});
    const writeMock = jest.spyOn(fs, 'outputFile');
    let versionedSidebar!: unknown;
    let versionedSidebarPath!: string;
    writeMock.mockImplementationOnce((filepath, content: string) => {
      versionedSidebarPath = filepath;
      versionedSidebar = JSON.parse(content);
    });
    let versionsPath!: string;
    let versions!: unknown;
    writeMock.mockImplementationOnce((filepath, content: string) => {
      versionsPath = filepath;
      versions = JSON.parse(content);
    });
    const consoleMock = jest.spyOn(console, 'log').mockImplementation(() => {});
    const options = {
      ...DEFAULT_OPTIONS,
      id: pluginId,
      path: 'community',
      sidebarPath: path.join(versionedSiteDir, 'community_sidebars.json'),
    };
    await cliDocsVersionCommand('2.0.0', options, {
      siteDir: versionedSiteDir,
      i18n: {
        locales: ['en', 'fr'],
        defaultLocale: 'en',
        currentLocale: 'en',
        path: 'i18n',
        localeConfigs: {
          en: {path: 'en', translate: true},
          fr: {path: 'fr', translate: true},
        },
      },
    } as unknown as LoadContext);
    expect(copyMock).toHaveBeenCalledWith(
      path.join(versionedSiteDir, options.path),
      getVersionDocsDirPath(versionedSiteDir, pluginId, '2.0.0'),
    );
    expect(copyMock).toHaveBeenCalledWith(
      path.join(
        versionedSiteDir,
        'i18n/fr/docusaurus-plugin-content-docs-community/current',
      ),
      path.join(
        versionedSiteDir,
        'i18n/fr/docusaurus-plugin-content-docs-community/version-2.0.0',
      ),
    );
    expect(versionedSidebar).toMatchSnapshot();
    expect(versionedSidebarPath).toEqual(
      getVersionSidebarsPath(versionedSiteDir, pluginId, '2.0.0'),
    );
    expect(versionsPath).toEqual(
      getVersionsFilePath(versionedSiteDir, pluginId),
    );
    expect(versions).toEqual(['2.0.0', '1.0.0']);
    expect(consoleMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /.*\[SUCCESS\].*\[community\].*: version .*2.0.0.* created!.*/,
      ),
    );

    copyMock.mockRestore();
    writeMock.mockRestore();
    consoleMock.mockRestore();
  });
});
