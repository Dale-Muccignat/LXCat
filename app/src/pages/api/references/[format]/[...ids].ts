import { Cite } from "@citation-js/core";
import "@citation-js/plugin-bibtex";
import "@citation-js/plugin-ris";
import { getReferences } from "@lxcat/database/dist/shared/queries/reference";
import { NextApiResponse } from "next";
import nc from "next-connect";
import { z, ZodError } from "zod";
import {
  AuthRequest,
  hasDeveloperOrDownloadRole,
  hasSessionOrAPIToken,
} from "../../../../auth/middleware";

const schema = z.object(
  {
    format: z.union([
      z.literal("bibtex"),
      z.literal("csl-json"),
      z.literal("ris"),
    ]),
    ids: z.array(z.string()).min(1),
  },
);

const handler = nc<AuthRequest, NextApiResponse>().use(hasSessionOrAPIToken)
  .use(hasDeveloperOrDownloadRole).get(async (req, res) => {
    try {
      const { format, ids } = schema.parse(req.query);

      const unique_ids = [...new Set(ids)];

      const references = await getReferences(unique_ids);

      if (references.length > 0) {
        switch (format) {
          case "bibtex":
          case "ris":
            const cite = new Cite(references);
            console.log(format);
            res.status(200).send(cite.format(format));
            break;
          case "csl-json":
            res.status(200).json(references);
        }
      } else {
        res.status(404).end(
          `Could not find any of the requested references: ${ids}.`,
        );
      }
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).end(error.message);
      }

      res.status(404).end("Unknown error, please contact the maintainers.");
    }
  });

export default handler;
