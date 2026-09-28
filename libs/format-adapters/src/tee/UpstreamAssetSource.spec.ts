import { UpstreamAssetSource } from './UpstreamAssetSource'

const bytes = new Uint8Array([1, 2, 3, 4])

function answering(status: number, headers: Record<string, string> = {}) {
  const requested: string[] = []
  const fetchImpl: typeof fetch = (input) => {
    requested.push(String(input))
    return Promise.resolve(new Response(status === 200 ? bytes : '', { status, headers }))
  }
  return { fetchImpl, requested }
}

describe('UpstreamAssetSource', () => {
  it('télécharge un fichier amont par son chemin, sous la base configurée', async () => {
    const { fetchImpl, requested } = answering(200, { 'content-type': 'image/webp' })
    const source = new UpstreamAssetSource({ baseUrl: 'https://amont/public/', fetchImpl })

    const asset = await source.fetch('/images/logos/operateur/opco-akto.webp')

    expect(requested).toEqual(['https://amont/public/images/logos/operateur/opco-akto.webp'])
    expect(asset).toEqual({
      data: Buffer.from(bytes),
      mimetype: 'image/webp',
      name: 'opco-akto.webp',
      size: 4,
    })
  })

  it("pointe par défaut sur le dossier public du front amont", () => {
    const source = new UpstreamAssetSource()
    expect(source.url('/images/projet/a.webp')).toMatch(
      /^https:\/\/raw\.githubusercontent\.com\/.+\/apps\/nuxt\/src\/public\/images\/projet\/a\.webp$/,
    )
  })

  it("propage une réponse en erreur avec son statut", async () => {
    const source = new UpstreamAssetSource({ fetchImpl: answering(404).fetchImpl })
    await expect(source.fetch('/images/absent.webp')).rejects.toMatchObject({
      name: 'UpstreamFetchError',
      status: 404,
      isNotFound: true,
    })
  })

  it.each([
    ['logo.svg', 'text/plain; charset=utf-8', 'image/svg+xml'],
    ['logo.png', null, 'image/png'],
    ['photo.JPG', 'application/octet-stream', 'image/jpeg'],
    ['photo.jpeg', null, 'image/jpeg'],
    ['logo.webp', null, 'image/webp'],
    ['fichier.bin', null, 'application/octet-stream'],
  ])("déduit le type de %s de son extension si l'en-tête n'est pas une image", async (name, contentType, expected) => {
    const headers: Record<string, string> = contentType ? { 'content-type': contentType } : {}
    const source = new UpstreamAssetSource({ fetchImpl: answering(200, headers).fetchImpl })
    expect((await source.fetch(`/images/${name}`)).mimetype).toBe(expected)
  })

  it.each([
    'images/relatif.webp',
    '//autre-hote/logo.webp',
    'https://autre-hote/logo.webp',
    '/images/../../secret.webp',
    '/images/%2e%2e/secret.webp',
    '/images\\..\\secret.webp',
    '/images/',
  ])('refuse le chemin %s sans rien télécharger', async (path) => {
    const { fetchImpl, requested } = answering(200)
    const source = new UpstreamAssetSource({ fetchImpl })
    await expect(source.fetch(path)).rejects.toThrow('Chemin amont invalide')
    expect(requested).toEqual([])
  })
})
