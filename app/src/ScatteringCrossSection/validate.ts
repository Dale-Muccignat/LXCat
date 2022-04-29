import Ajv from 'ajv'
import CrossSectionInputAsJsonSchema from "../generated/input/CrossSection.schema.json"

const ajv = new Ajv()

export const validate = ajv.compile(CrossSectionInputAsJsonSchema)
