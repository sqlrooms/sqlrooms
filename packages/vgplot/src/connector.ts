import {getDuckConn} from '@sqlrooms/duckdb';
import {useQuery} from '@tanstack/react-query';
import {
  createAPIContext,
  coordinator as createCoordinator,
} from '@uwdata/vgplot';

type MosaicPlotConn = {
  db: any;
  con: any;
  query: (query: {type: string; sql: string}) => Promise<any>;
  coordinator: any;
  mosaicApi: any;
};

let mosaicPlotConn: MosaicPlotConn | null = null;

export async function clearMosaicPlotConn() {
  if (mosaicPlotConn?.coordinator) {
    await mosaicPlotConn.coordinator.clear();
  }
}

export async function getMosaicPlotConn(): Promise<MosaicPlotConn> {
  if (mosaicPlotConn) {
    return mosaicPlotConn;
  }
  const {db, conn} = await getDuckConn();
  const connector = {
    db,
    con: conn,
    query: async (query: {type: string; sql: string}) => {
      const {type, sql} = query;
      if (process.env.NODE_ENV === 'development') {
        console.log(sql);
      }
      const result = await conn.query(sql);
      return type === 'exec'
        ? undefined
        : type === 'arrow'
          ? result
          : Array.from(result);
    },
  };
  // TODO: support socketConnector("ws://localhost:8001/")
  const coordinator = createCoordinator();
  // const coordinator = new Coordinator();
  coordinator.databaseConnector(connector);
  // TODO: context should be recreated when loading a new project
  const mosaicApi = createAPIContext({coordinator});
  const mpc = {...connector, coordinator, mosaicApi};
  mosaicPlotConn = mpc;
  return mosaicPlotConn;
}

export function useMosaicPlotConn() {
  const res = useQuery(
    ['mosaicPlotConn'],
    async () => {
      return await getMosaicPlotConn();
    },
    {suspense: true},
  );
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return res.data!;
}
