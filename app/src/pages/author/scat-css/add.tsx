import type { GetServerSideProps, NextPage } from "next";
import { Layout } from "../../../shared/Layout";
import type { ErrorObject } from "ajv";
import { useState } from "react";
import { mustBeAuthor } from "../../../auth/middleware";
import { CrossSectionSetInputOwned } from "@lxcat/database/dist/css/queries/author_read";
import Link from "next/link";
import {
  listOrganizations,
  OrganizationFromDB,
  userMemberships,
} from "@lxcat/database/dist/auth/queries";
import { AddForm } from "../../../ScatteringCrossSectionSet/AddForm";

interface Props {
  organizations: OrganizationFromDB[];
}

const AddCrossSectionSetPage: NextPage<Props> = ({ organizations }) => {
  const [errors, setErrors] = useState<ErrorObject[]>([]);
  const [id, setId] = useState("");

  async function onSubmit(
    newSet: CrossSectionSetInputOwned,
    newMessage: string
  ) {
    const url = `/api/scat-css`;
    const body = JSON.stringify({
      doc: newSet,
      message: newMessage,
    });
    const headers = new Headers({
      Accept: "application/json",
      "Content-Type": "application/json",
    });
    const init = { method: "POST", body, headers };
    const res = await fetch(url, init);
    const data = await res.json();
    if (res.ok) {
      setId(data.id);
    } else {
      setErrors(data.errors);
    }
  }

  return (
    <Layout>
      <h1>Edit scattering cross section set</h1>
      <AddForm onSubmit={onSubmit} organizations={organizations} />
      {errors.length > 0 && (
        <div>
          <span>Error(s) during upload</span>
          <ul>
            {errors.map((e, i) => (
              <li key={i}>
                {e.message}, {JSON.stringify(e.params, undefined, 2)}{" "}
                {e.instancePath && `@ ${e.instancePath}`}
              </li>
            ))}
          </ul>
        </div>
      )}
      {id && (
        <span>Update successful, a draft has been created with id is {id}</span>
      )}
      <Link href={`/author/scat-css`}>
        <a>Back</a>
      </Link>
    </Layout>
  );
};

export default AddCrossSectionSetPage;

export const getServerSideProps: GetServerSideProps<
  Props,
  { id: string }
> = async (context) => {
  const me = await mustBeAuthor(context);

  const organizations = await userMemberships(me.email);
  return {
    props: {
      organizations,
    },
  };
};
