import {getDuckConn} from '@sqlrooms/duckdb';
import {useQuery} from '@tanstack/react-query';
import {coordinator} from '@uwdata/vgplot';

type MosaicPlotConn = {
  db: any;
  con: any;
  query: (query: {type: string; sql: string}) => Promise<any>;
  coordinator: any;
};

let mosaicPlotConn: MosaicPlotConn | null = null;

export async function clearMosaicPlotConn() {
  if (mosaicPlotConn?.coordinator) {
    await mosaicPlotConn.coordinator.clear();
  }
}

export async function getMosaicPlotConn() {
  if (!mosaicPlotConn) {
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
    const coord = coordinator();
    coord.databaseConnector(connector);
    mosaicPlotConn = {...connector, coordinator: coord};
  }
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
