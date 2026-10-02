/** A downloaded upstream file, shaped like the `file` argument of Payload's `payload.create`. */
export interface UpstreamAsset {
  data: Buffer
  mimetype: string
  name: string
  size: number
}
