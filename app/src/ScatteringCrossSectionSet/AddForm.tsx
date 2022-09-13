import { OrganizationFromDB } from "@lxcat/database/dist/auth/queries";
import { CrossSectionSetInputOwned } from "@lxcat/database/dist/css/queries/author_read";
import { CrossSectionSetRaw } from "@lxcat/schema/dist/css/input";
import { useMemo } from "react";
import { EditForm } from "./EditForm";

interface Props {
  onSubmit: (newSet: CrossSectionSetInputOwned, newMessage: string) => void;
  organizations: OrganizationFromDB[];
}

export const AddForm = ({ onSubmit, organizations }: Props) => {
  const newSet: CrossSectionSetRaw = useMemo(() => {
    return {
      name: "Some set name",
      description: "Some set description",
      complete: false,
      contributor: "Some organization",
      processes: [],
      states: {},
      references: {},
    };
  }, []);
  return (
    <EditForm
      set={newSet}
      commitMessage=""
      onSubmit={onSubmit}
      organizations={organizations}
    />
  );
};
