import { mkdir, rm, writeFile } from 'node:fs/promises';

const repository = 'devlanes-run/devlanes';
const files = [
  ['schema.json', 'v1/schema.json'],
  ['user-schema.json', 'v1/user-schema.json'],
  ['install.sh', 'install.sh']
];

export async function downloadRelease(fetcher = fetch, token = process.env.GH_TOKEN) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetcher(`https://api.github.com/repos/${repository}/releases/latest`, {
    headers,
    signal: AbortSignal.timeout(30_000)
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Release lookup failed: HTTP ${response.status}`);
  const release = await response.json();
  if (release.draft || release.prerelease || !/^v\d+\.\d+\.\d+$/.test(release.tag_name)) {
    throw new Error('Expected a published stable devlanes release');
  }

  const downloads = await Promise.all(
    files.map(async ([name, path]) => {
      const asset = release.assets.find((entry) => entry.name === name);
      if (!asset) throw new Error(`${release.tag_name} is missing ${name}`);
      const expected = `https://github.com/${repository}/releases/download/${release.tag_name}/${name}`;
      if (asset.browser_download_url !== expected)
        throw new Error(`Unexpected asset URL for ${name}`);
      const result = await fetcher(expected, { signal: AbortSignal.timeout(30_000) });
      if (!result.ok) throw new Error(`${name} download failed: HTTP ${result.status}`);
      const content = await result.text();
      if (name.endsWith('.json')) {
        const schema = JSON.parse(content);
        if (!schema.$schema || !schema.$id) throw new Error(`Invalid schema: ${name}`);
      } else if (!content.startsWith('#!')) {
        throw new Error('Installer does not start with a shebang');
      }
      return { path, content };
    })
  );
  return { tag: release.tag_name, files: downloads };
}

if (import.meta.main) {
  const release = await downloadRelease();
  const publicDir = new URL('../public/', import.meta.url);
  if (!release) {
    // A later local build must not retain files from a previous download.
    for (const [, path] of files) await rm(new URL(path, publicDir), { force: true });
    console.log('No stable devlanes release yet; skipping release files.');
  } else {
    await mkdir(new URL('v1/', publicDir), { recursive: true });
    for (const file of release.files) await writeFile(new URL(file.path, publicDir), file.content);
    console.log(`Downloaded schemas and installer from ${release.tag}.`);
  }
}
