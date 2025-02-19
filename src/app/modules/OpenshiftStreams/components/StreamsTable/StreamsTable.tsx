import { FunctionComponent, MouseEvent, useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  IAction,
  IRowData,
  ISeparator,
  ISortBy,
  OnSort,
  sortable,
  SortByDirection,
} from "@patternfly/react-table";
import { KafkaRequest } from "@rhoas/kafka-management-sdk";
import {
  getFormattedDate,
  getLoadingRowsCount,
  getSkeletonForRows,
  InstanceStatus,
  InstanceType,
} from "@app/utils";
import { Skeleton } from "@patternfly/react-core";
import { Link } from "react-router-dom";
import {
  StatusColumn,
  StreamsToolbar,
  StreamsToolbarProps,
} from "@app/modules/OpenshiftStreams/components";
import { MASTable, MASTableProps } from "@app/common";
import { Pagination } from "@app/modules/OpenshiftStreams/components/StreamsTable/Pagination";
import { NoResultsFound } from "@app/modules/OpenshiftStreams/components/StreamsTable/NoResultsFound";
import { FormatDate } from "@rhoas/app-services-ui-components";
import { add } from "date-fns";

export type KafkaRequestWithSize = KafkaRequest & {
  size?: { trialDurationHours: number };
};

export type StreamsTableProps = Pick<
  StreamsToolbarProps,
  | "page"
  | "perPage"
  | "total"
  | "filterSelected"
  | "setFilterSelected"
  | "filteredValue"
  | "setFilteredValue"
  | "onCreate"
  | "refresh"
  | "handleCreateInstanceModal"
> & {
  onDeleteInstance: (instance: KafkaRequest) => Promise<void>;
  onChangeOwner: (instance: KafkaRequest) => Promise<void>;
  onViewInstance: (instance: KafkaRequest) => void;
  onViewConnection: (instance: KafkaRequest) => void;
  loggedInUser: string | undefined;
  expectedTotal: number;
  kafkaDataLoaded: boolean;
  kafkaInstanceItems?: KafkaRequestWithSize[];
  isOrgAdmin?: boolean;
  setOrderBy: (order: string) => void;
  orderBy: string;
  selectedInstanceName: string | undefined;
};
export const StreamsTable: FunctionComponent<StreamsTableProps> = ({
  onDeleteInstance,
  onChangeOwner,
  onViewInstance,
  onViewConnection,
  loggedInUser,
  page,
  perPage,
  total,
  expectedTotal,
  kafkaDataLoaded,
  kafkaInstanceItems,
  isOrgAdmin,
  setOrderBy,
  orderBy,
  filterSelected,
  setFilterSelected,
  filteredValue,
  setFilteredValue,
  onCreate,
  refresh,
  handleCreateInstanceModal,
  selectedInstanceName,
}) => {
  const { t } = useTranslation(["kasTemporaryFixMe"]);

  const cells = [
    { title: t("name"), transforms: [sortable] },
    { title: t("cloud_provider"), transforms: [sortable] },
    { title: t("region"), transforms: [sortable] },
    { title: t("owner"), transforms: [sortable] },
    { title: t("status"), transforms: [sortable] },
    { title: t("time_created"), transforms: [sortable] },
  ];

  const sortBy = useMemo((): ISortBy | undefined => {
    const getIndexForSortParameter = (parameter: string) => {
      switch (parameter.toLowerCase()) {
        case "name":
          return 0;
        case "cloud_provider":
          return 1;
        case "region":
          return 2;
        case "owner":
          return 3;
        case "status":
          return 4;
        case "created_at":
          return 5;
        default:
          return undefined;
      }
    };

    const sort: string[] = orderBy?.split(" ") || [];
    if (sort.length > 1) {
      return {
        index: getIndexForSortParameter(sort[0]),
        direction:
          sort[1] === SortByDirection.asc
            ? SortByDirection.asc
            : SortByDirection.desc,
      };
    }
    return;
  }, [orderBy]);

  const rows = useMemo(() => {
    const tableRow: (IRowData | string[])[] | undefined = [];
    const loadingCount: number = getLoadingRowsCount(
      page,
      perPage,
      expectedTotal
    );

    if (!kafkaDataLoaded) {
      return getSkeletonForRows({
        loadingCount,
        skeleton: <Skeleton />,
        length: cells.length,
      });
    }

    kafkaInstanceItems?.forEach((row: IRowData) => {
      const {
        name,
        cloud_provider,
        region,
        created_at,
        status,
        owner,
        instance_type,
        size,
      } = row;
      const cloudProviderDisplayName = t(cloud_provider);
      const regionDisplayName = t(region);

      tableRow.push({
        cells: [
          {
            title:
              status === InstanceStatus.DEPROVISION ||
              status !== InstanceStatus.READY ? (
                name
              ) : (
                <Link
                  to={`kafkas/${row?.id}/dashboard`}
                  data-ouia-component-id={"table-link"}
                >
                  {name}
                </Link>
              ),
          },
          cloudProviderDisplayName,
          regionDisplayName,
          owner,
          {
            title: <StatusColumn status={status} instanceName={name} />,
          },
          {
            title: (
              <>
                {getFormattedDate(created_at, t("ago"))}
                <br />
                {(instance_type === InstanceType?.developer ||
                  instance_type === InstanceType?.eval) &&
                  (size?.trialDurationHours ? (
                    <Trans
                      i18nKey="common.expires_in"
                      ns={["kasTemporaryFixMe"]}
                      components={{
                        time: (
                          <FormatDate
                            date={add(new Date(created_at), {
                              hours: size?.trialDurationHours,
                            })}
                            format="expiration"
                          />
                        ),
                      }}
                    />
                  ) : (
                    <Skeleton />
                  ))}
              </>
            ),
          },
        ],
        originalData: row,
      });
    });
    return tableRow;
  }, [
    page,
    perPage,
    expectedTotal,
    kafkaDataLoaded,
    kafkaInstanceItems,
    cells.length,
    t,
  ]);

  const actionResolver = (rowData: IRowData) => {
    if (!kafkaDataLoaded) {
      return [];
    }
    const originalData: KafkaRequest = rowData.originalData;
    if (
      originalData.status === InstanceStatus.DEPROVISION ||
      originalData.status === InstanceStatus.DELETED
    ) {
      return [];
    }

    const isUserSameAsLoggedIn =
      (loggedInUser !== undefined && originalData.owner === loggedInUser) ||
      (isOrgAdmin !== undefined && isOrgAdmin === true);

    let additionalProps;

    if (!isUserSameAsLoggedIn) {
      additionalProps = {
        tooltip: true,
        isDisabled: true,
        style: {
          pointerEvents: "auto",
          cursor: "default",
        },
      };
    }
    const resolver: (IAction | ISeparator)[] = [
      {
        title: t("view_details"),
        id: "view-instanceDrawerInstance",
        ["data-testid"]: "tableStreams-actionDetails",
        onClick: (event: MouseEvent) =>
          onSelectKebabDropdownOption(
            event,
            originalData,
            "view-instanceDrawerInstance"
          ),
      } as IAction,
      {
        title: t("view_connection_information"),
        id: "connect-instanceDrawerInstance",
        ["data-testid"]: "tableStreams-actionConnection",
        onClick: (event: MouseEvent) =>
          onSelectKebabDropdownOption(
            event,
            originalData,
            "connect-instanceDrawerInstance"
          ),
      } as IAction,
      {
        title: t("change_owner"),
        id: "change-owner",
        ["data-testid"]: "tableStreams-actionChangeOwner",
        onClick: (event: MouseEvent) =>
          isUserSameAsLoggedIn &&
          onSelectKebabDropdownOption(event, originalData, "change-owner"),
        ...additionalProps,
        tooltipProps: {
          position: "left",
          content: t("no_permission_to_change_owner"),
        },
      } as IAction,
      {
        title: t("delete_instance"),
        id: "delete-instanceDrawerInstance",
        ["data-testid"]: "tableStreams-actionDelete",
        onClick: (event: MouseEvent) =>
          isUserSameAsLoggedIn &&
          onSelectKebabDropdownOption(
            event,
            originalData,
            "delete-instanceDrawerInstance"
          ),
        ...additionalProps,
        tooltipProps: {
          position: "left",
          content: t("no_permission_to_delete_kafka"),
        },
      } as IAction,
    ];
    return resolver;
  };

  const onSelectKebabDropdownOption = (
    event: MouseEvent,
    originalData: KafkaRequest,
    selectedOption: string
  ) => {
    if (selectedOption === "view-instanceDrawerInstance") {
      onViewInstance(originalData);
      //set selected row for view instanceDrawerInstance and connect instanceDrawerInstance
    } else if (selectedOption === "connect-instanceDrawerInstance") {
      onViewConnection(originalData);
    } else if (selectedOption === "change-owner") {
      onChangeOwner(originalData);
    } else if (selectedOption === "delete-instanceDrawerInstance") {
      deleteInstance(originalData);
    }
    // Set focus back on previous selected element i.e. kebab button

    const previousNode =
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      event?.target?.parentElement?.parentElement?.previousSibling;
    if (previousNode !== undefined && previousNode !== null) {
      (previousNode as HTMLElement).focus();
    }
  };

  const deleteInstance = async (kafka: KafkaRequest) => {
    await onDeleteInstance(kafka);
  };

  const onSort: OnSort = (_event, index, direction, extraData) => {
    const getParameterForSortIndex = (index: number) => {
      switch (index) {
        case 0:
          return "name";
        case 1:
          return "cloud_provider";
        case 2:
          return "region";
        case 3:
          return "owner";
        case 4:
          return "status";
        case 5:
          return "created_at";
        default:
          return "";
      }
    };

    let myDirection = direction;
    if (sortBy?.index !== index && extraData.property === "time-created") {
      // trick table to sort descending first for date column
      // https://github.com/patternfly/patternfly-react/issues/5329
      myDirection = SortByDirection.desc;
    }
    setOrderBy(`${getParameterForSortIndex(index)} ${myDirection}`);
  };

  const onRowClick: MASTableProps["onRowClick"] = (event, _, row) => {
    if (event.target instanceof HTMLElement) {
      const tagName = event.target.tagName.toLowerCase();
      // Open instance drawer on row click except kebab button click or opening the kafka instance
      if (tagName === "button" || tagName === "a") {
        return;
      }
    }
    onViewInstance(row?.originalData);
  };

  return (
    <>
      <StreamsToolbar
        filterSelected={filterSelected}
        setFilterSelected={setFilterSelected}
        total={total}
        page={page}
        perPage={perPage}
        filteredValue={filteredValue}
        setFilteredValue={setFilteredValue}
        onCreate={onCreate}
        refresh={refresh}
        handleCreateInstanceModal={handleCreateInstanceModal}
      />
      <MASTable
        tableProps={{
          cells,
          rows,
          "aria-label": t("cluster_instance_list"),
          actionResolver,
          onSort,
          sortBy,
          hasDefaultCustomRowWrapper: true,
          ouiaId: "table-kafka-instances",
        }}
        activeRow={selectedInstanceName}
        onRowClick={onRowClick}
        rowDataTestId="tableStreams-row"
        loggedInUser={loggedInUser}
      />
      <NoResultsFound
        count={kafkaInstanceItems?.length || 0}
        dataLoaded={kafkaDataLoaded}
      />
      <Pagination total={total} page={page} perPage={perPage} />
    </>
  );
};
