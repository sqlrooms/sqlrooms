import { useMosaicPlotConn } from '@sqlrooms/vgplot'
import { MosaicClient } from '@uwdata/mosaic-core'
import throttle from 'lodash.throttle'
import { useEffect, useRef, useState } from 'react'
import { MosaicClientObject, MosaicClientResult, MosaicFilterSelection, MosaicQueryObject } from './types'

export type UseMosaicClientProps = {
  query: MosaicQueryObject;
  filterSelection: MosaicFilterSelection;
  enabled?: boolean;
  throttleDelay?: number;
}
export type UseMosaicClientReturn = {
  client: MosaicClientObject;
  data: MosaicClientResult;
  isFetching: boolean;
}

export default function useMosaicClient (props: UseMosaicClientProps): UseMosaicClientReturn {
  const { enabled, filterSelection, query, throttleDelay = 1000 } = props

  const clientRef = useRef<MosaicClientObject>()
  const [result, setResult] = useState<MosaicClientResult>()
  const { coordinator } = useMosaicPlotConn()
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!coordinator || !enabled) return

    const client = new class extends MosaicClient {
      constructor () {
        super(filterSelection)      
        //this._requestUpdate = throttle(() => this.requestQuery(), throttleDelay)
      }


      query (filter = []): MosaicQueryObject {
        return query.clone().where(filter)
      }

      // requestUpdate() {
      //   this._requestUpdate();
      // }

      queryPending (): MosaicQueryObject {
        setPending(true)
        return this
      }

      queryResult (data: MosaicClientResult): MosaicClientObject {
        setResult(data?.toArray())
        setPending(false)
        return this
      }

      fields () {
        // TODO: implement fields
        // see https://uwdata.github.io/mosaic/api/core/client.html#fields
        // see https://github.com/uwdata/mosaic/blob/main/packages/plot/src/marks/Mark.js#L114
        return super.fields()
      }
    }()

    clientRef.current = client
    coordinator.connect(client)

    return () => {
      clientRef.current = null
      coordinator.disconnect(clientRef.current)
    }
  }, [enabled, coordinator])

  return {
    client: clientRef.current,
    data: result,
    isFetching: !result || pending,
  }
}
