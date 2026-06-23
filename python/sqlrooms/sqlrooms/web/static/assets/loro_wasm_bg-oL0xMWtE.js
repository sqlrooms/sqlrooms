import { r as e } from "./chunk-jRWAZmH_.js";
let mr, lc, ds, ua, uo, di, Gn, Vs, Ho, Vi, Va, Hr, tr, Zs, Qo, Zi, Za, Qr, Tc, Fs, Fo, Pi, Pa, Fr, Hn, Rs, zo, Ri, Ra, zr, Vn, Tn, Ro, Li, La, Rr, Xn, Ks, qo, Ki, Ka, qr, or, tc, rs, na, no, ri, rr, $s, es, $i, $a, ei, Zn, qs, Jo, qi, qa, Jr, lr, ic, os, aa, ao, oi, sr, nc, is, ra, ro, ii, Qn, Js, Yo, Ji, Ja, Yr, qn, Us, Wo, Ui, Ua, Wr, Jn, Ws, Go, Wi, Wa, Gr, Un, zs, Bo, zi, za, Br, Yn, Gs, Ko, Gi, Ga, Kr, pr, cc, us, la, lo, ui, $n, Ys, Xo, Yi, Ya, Xr, Dc, Ps, Po, Ni, Na, Pr, Bn, Ls, Lo, Ii, Ia, Lr, ir, ec, ts, ea, eo, ti, nr, Qs, $o, Qi, Qa, $r, ar, $, ns, ta, to, ni, dr, oc, cs, sa, so, ci, ur, ac, ss, oa, oo, si, fr, sc, ls, ca, co, li, xc, ks, ko, Oi, Oa, jr, An, _s, _o, _i, F, ga, br, yc, Ms, Mo, ji, ja, _c, Nn, bs, bo, bi, U, ya, Cr, Fn, Cs, Co, Ci, Y, Sa, Tr, fs, fo, fi, uc, da, hr, In, ws, wo, wi, ve, Ca, Er, wc, Os, Oo, hc, Da, Ar, zn, Ds, Do, Di, r, Ea, kr, kn, gs, go, gi, mc, ha, yr, Kn, Hs, Uo, Hi, Ha, Ur, Wn, Bs, Vo, Bi, Ba, Vr, Pn, xs, xo, xi, G, ba, wn, Rn, Es, Eo, Ei, M, Ta, Or, Dn, ms, mo, mi, fc, pa, _r, jn, vs, vo, vi, z, _a, xr, Ln, Ts, To, Ti, a, wa, Dr, cr, rc, as, ia, io, ai, On, hs, ho, hi, pc, ma, vr, Mn, ys, yo, yi, V, va, Sr, En, ps, po, pi, dc, fa, gr, gc, Ss, So, Si, q, xa, wr, Cc, As, Ao, ki, ka, Mr, Ec, Is, Io, Fi, Fa, Ir, bc, Ns, No, Mi, Ma, vc, Sc, js, jo, Ai, Aa, Nr, er, Xs, Zo, Xi, Xa, Zr;
let __tla = (async ()=>{
    let t, n, i;
    t = `/assets/loro_wasm_bg-DP4dC0x3.wasm`;
    n = async (e = {}, t)=>{
        let n;
        if (t.startsWith(`data:`)) {
            let r = t.replace(/^data:.*?base64,/, ``), i;
            if (typeof Buffer == `function` && typeof Buffer.from == `function`) i = Buffer.from(r, `base64`);
            else if (typeof atob == `function`) {
                let e = atob(r);
                i = new Uint8Array(e.length);
                for(let t = 0; t < e.length; t++)i[t] = e.charCodeAt(t);
            } else throw Error(`Cannot decode base64-encoded data URL`);
            n = await WebAssembly.instantiate(i, e);
        } else {
            let r = await fetch(t), i = r.headers.get(`Content-Type`) || ``;
            if (`instantiateStreaming` in WebAssembly && i.startsWith(`application/wasm`)) n = await WebAssembly.instantiateStreaming(r, e);
            else {
                let t = await r.arrayBuffer();
                n = await WebAssembly.instantiate(t, e);
            }
        }
        return n.instance.exports;
    };
    r = e({
        AwarenessWasm: ()=>fe,
        ChangeModifier: ()=>me,
        Cursor: ()=>N,
        EphemeralStoreWasm: ()=>F,
        LORO_VERSION: ()=>oe,
        LoroCounter: ()=>L,
        LoroDoc: ()=>z,
        LoroList: ()=>V,
        LoroMap: ()=>U,
        LoroMovableList: ()=>G,
        LoroText: ()=>q,
        LoroTree: ()=>Y,
        LoroTreeNode: ()=>X,
        UndoManager: ()=>ve,
        VersionVector: ()=>Q,
        __wbg_String_8f0eb39a4a4c2f66: ()=>ye,
        __wbg_apply_36be6a55257c99bf: ()=>be,
        __wbg_apply_eb9e9b97497f91e4: ()=>xe,
        __wbg_buffer_609cc3eee51ed158: ()=>Se,
        __wbg_call_672a4d21634d4a24: ()=>Ce,
        __wbg_call_7cccdd69e0791ae2: ()=>we,
        __wbg_call_833bed5770ea2041: ()=>Te,
        __wbg_call_b8adc8b1d0a0d8eb: ()=>Ee,
        __wbg_changemodifier_new: ()=>De,
        __wbg_crypto_574e78ad8b13b65f: ()=>Oe,
        __wbg_cursor_new: ()=>ke,
        __wbg_done_769e5ede4b31c67b: ()=>Ae,
        __wbg_entries_3265d4158b33e5dc: ()=>je,
        __wbg_entries_c8a90a7ed73e84ce: ()=>Me,
        __wbg_error_7534b8e9a36f1ab4: ()=>Ne,
        __wbg_error_fd027616b8006afa: ()=>Pe,
        __wbg_from_2a5d3e218e67aa85: ()=>Fe,
        __wbg_getOwnPropertySymbols_97eebed6fe6e08be: ()=>Ie,
        __wbg_getRandomValues_b8f5dbd5f3995a9e: ()=>Le,
        __wbg_get_67b2ba62fc30de12: ()=>Re,
        __wbg_get_b9b93047fe3cf45b: ()=>ze,
        __wbg_getindex_5b00c274b05714aa: ()=>Be,
        __wbg_getwithrefkey_1dc361bd10053bfe: ()=>Ve,
        __wbg_instanceof_ArrayBuffer_e14585432e3737fc: ()=>He,
        __wbg_instanceof_Map_f3469ce2244d2430: ()=>Ue,
        __wbg_instanceof_Object_7f2dcef8f78644a4: ()=>We,
        __wbg_instanceof_Uint8Array_17156bcf118086a9: ()=>Ge,
        __wbg_isArray_a1eab7e0d067391b: ()=>Ke,
        __wbg_isSafeInteger_343e2beeeece1bb0: ()=>qe,
        __wbg_iterator_9a24c88df860dc65: ()=>Je,
        __wbg_length_a446193dc22c12f8: ()=>Ye,
        __wbg_length_e2d2a49132c1b256: ()=>Xe,
        __wbg_log_0cc1b7768397bcfe: ()=>Ze,
        __wbg_log_62fc5f7c674bfa10: ()=>Qe,
        __wbg_log_cb9e190acc5753fb: ()=>$e,
        __wbg_lorocounter_new: ()=>et,
        __wbg_lorolist_new: ()=>tt,
        __wbg_loromap_new: ()=>nt,
        __wbg_loromovablelist_new: ()=>rt,
        __wbg_lorotext_new: ()=>it,
        __wbg_lorotree_new: ()=>at,
        __wbg_lorotreenode_new: ()=>ot,
        __wbg_mark_7438147ce31e9d4b: ()=>st,
        __wbg_measure_fb7825c11612c823: ()=>ct,
        __wbg_msCrypto_a61aeb35a24c1329: ()=>lt,
        __wbg_new_405e22f390576ce2: ()=>ut,
        __wbg_new_5e0be73521bc8c17: ()=>dt,
        __wbg_new_78feb108b6472713: ()=>ft,
        __wbg_new_8a6f238a6ece86ea: ()=>pt,
        __wbg_new_a12002a7f91c75be: ()=>mt,
        __wbg_newnoargs_105ed471475aaf50: ()=>ht,
        __wbg_newwithbyteoffsetandlength_d97e637ebe145a9a: ()=>gt,
        __wbg_newwithlength_a381634e90c276d4: ()=>_t,
        __wbg_newwithlength_c4c419ef0bc8a1f8: ()=>vt,
        __wbg_next_25feadfc0913fea9: ()=>yt,
        __wbg_next_6574e1a8a62d1055: ()=>bt,
        __wbg_node_905d3e251edff8a2: ()=>xt,
        __wbg_now_6727e3e536e11536: ()=>St,
        __wbg_ownKeys_3930041068756f1f: ()=>Ct,
        __wbg_process_dc0fbacc7c1c06f7: ()=>wt,
        __wbg_push_737cfc8c1432c2c6: ()=>Tt,
        __wbg_randomFillSync_ac0988aba3254290: ()=>Et,
        __wbg_require_60cc747a6bc5215a: ()=>Dt,
        __wbg_resolve_4851785c9c5f573d: ()=>Ot,
        __wbg_set_37837023f3d740e8: ()=>kt,
        __wbg_set_3f1d0b984ed272ed: ()=>At,
        __wbg_set_65595bdd868b3009: ()=>jt,
        __wbg_set_8fc6bf8a5b1071d1: ()=>Mt,
        __wbg_set_bb8cecf6a62b9f46: ()=>Nt,
        __wbg_set_wasm: ()=>a,
        __wbg_setindex_dcd71eabf405bde1: ()=>Pt,
        __wbg_stack_0ed75d68575b0f3c: ()=>Ft,
        __wbg_static_accessor_GLOBAL_88a902d13a557d07: ()=>It,
        __wbg_static_accessor_GLOBAL_THIS_56578be7e9f832b0: ()=>Lt,
        __wbg_static_accessor_SELF_37c5d418e4bf5819: ()=>Rt,
        __wbg_static_accessor_WINDOW_5de37043a91a9c40: ()=>zt,
        __wbg_subarray_aa9065fa9dc5df96: ()=>Bt,
        __wbg_then_44b73946d2fb3e7d: ()=>Vt,
        __wbg_value_cd1ffa7b1ab794f1: ()=>Ht,
        __wbg_versions_c01dfd4722a88165: ()=>Ut,
        __wbg_versionvector_new: ()=>Wt,
        __wbg_warn_5cdab1103c5473b2: ()=>Gt,
        __wbindgen_as_number: ()=>Kt,
        __wbindgen_bigint_from_i64: ()=>qt,
        __wbindgen_bigint_from_u64: ()=>Jt,
        __wbindgen_bigint_get_as_i64: ()=>Yt,
        __wbindgen_boolean_get: ()=>Xt,
        __wbindgen_cb_drop: ()=>Zt,
        __wbindgen_closure_wrapper746: ()=>Qt,
        __wbindgen_closure_wrapper748: ()=>$t,
        __wbindgen_debug_string: ()=>en,
        __wbindgen_error_new: ()=>tn,
        __wbindgen_in: ()=>nn,
        __wbindgen_is_array: ()=>rn,
        __wbindgen_is_bigint: ()=>an,
        __wbindgen_is_falsy: ()=>on,
        __wbindgen_is_function: ()=>sn,
        __wbindgen_is_null: ()=>cn,
        __wbindgen_is_object: ()=>ln,
        __wbindgen_is_string: ()=>un,
        __wbindgen_is_undefined: ()=>dn,
        __wbindgen_jsval_eq: ()=>fn,
        __wbindgen_jsval_loose_eq: ()=>pn,
        __wbindgen_memory: ()=>mn,
        __wbindgen_number_get: ()=>hn,
        __wbindgen_number_new: ()=>gn,
        __wbindgen_object_clone_ref: ()=>_n,
        __wbindgen_object_drop_ref: ()=>vn,
        __wbindgen_rethrow: ()=>yn,
        __wbindgen_string_get: ()=>bn,
        __wbindgen_string_new: ()=>xn,
        __wbindgen_throw: ()=>Sn,
        __wbindgen_typeof: ()=>Cn,
        callPendingEvents: ()=>M,
        decodeFrontiers: ()=>re,
        decodeImportBlobMeta: ()=>ae,
        encodeFrontiers: ()=>ie,
        redactJsonUpdates: ()=>ne,
        run: ()=>se,
        setDebug: ()=>ce
    });
    a = function(e) {
        i = e;
    };
    var o = Array(128).fill(void 0);
    o.push(void 0, null, !0, !1);
    function s(e) {
        return o[e];
    }
    var c = 0, l = null;
    function u() {
        return (l === null || l.byteLength === 0) && (l = new Uint8Array(i.memory.buffer)), l;
    }
    var d = new (typeof TextEncoder > `u` ? (0, module.require)(`util`).TextEncoder : TextEncoder)(`utf-8`), f = typeof d.encodeInto == `function` ? function(e, t) {
        return d.encodeInto(e, t);
    } : function(e, t) {
        let n = d.encode(e);
        return t.set(n), {
            read: e.length,
            written: n.length
        };
    };
    function p(e, t, n) {
        if (n === void 0) {
            let n = d.encode(e), r = t(n.length, 1) >>> 0;
            return u().subarray(r, r + n.length).set(n), c = n.length, r;
        }
        let r = e.length, i = t(r, 1) >>> 0, a = u(), o = 0;
        for(; o < r; o++){
            let t = e.charCodeAt(o);
            if (t > 127) break;
            a[i + o] = t;
        }
        if (o !== r) {
            o !== 0 && (e = e.slice(o)), i = n(i, r, r = o + e.length * 3, 1) >>> 0;
            let t = u().subarray(i + o, i + r), a = f(e, t);
            o += a.written, i = n(i, r, o, 1) >>> 0;
        }
        return c = o, i;
    }
    var m = null;
    function h() {
        return (m === null || m.buffer.detached === !0 || m.buffer.detached === void 0 && m.buffer !== i.memory.buffer) && (m = new DataView(i.memory.buffer)), m;
    }
    var g = o.length;
    function _(e) {
        g === o.length && o.push(o.length + 1);
        let t = g;
        return g = o[t], o[t] = e, t;
    }
    function v(e, t) {
        try {
            return e.apply(this, t);
        } catch (e) {
            i.__wbindgen_exn_store(_(e));
        }
    }
    var ee = new (typeof TextDecoder > `u` ? (0, module.require)(`util`).TextDecoder : TextDecoder)(`utf-8`, {
        ignoreBOM: !0,
        fatal: !0
    });
    ee.decode();
    function y(e, t) {
        return e >>>= 0, ee.decode(u().subarray(e, e + t));
    }
    function te(e) {
        e < 132 || (o[e] = g, g = e);
    }
    function b(e) {
        let t = s(e);
        return te(e), t;
    }
    function x(e) {
        return e == null;
    }
    var S = typeof FinalizationRegistry > `u` ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((e)=>{
        i.__wbindgen_export_4.get(e.dtor)(e.a, e.b);
    });
    function C(e, t, n, r) {
        let a = {
            a: e,
            b: t,
            cnt: 1,
            dtor: n
        }, o = (...e)=>{
            a.cnt++;
            let t = a.a;
            a.a = 0;
            try {
                return r(t, a.b, ...e);
            } finally{
                --a.cnt === 0 ? (i.__wbindgen_export_4.get(a.dtor)(t, a.b), S.unregister(a)) : a.a = t;
            }
        };
        return o.original = a, S.register(o, a, a), o;
    }
    function w(e) {
        let t = typeof e;
        if (t == `number` || t == `boolean` || e == null) return `${e}`;
        if (t == `string`) return `"${e}"`;
        if (t == `symbol`) {
            let t = e.description;
            return t == null ? `Symbol` : `Symbol(${t})`;
        }
        if (t == `function`) {
            let t = e.name;
            return typeof t == `string` && t.length > 0 ? `Function(${t})` : `Function`;
        }
        if (Array.isArray(e)) {
            let t = e.length, n = `[`;
            t > 0 && (n += w(e[0]));
            for(let r = 1; r < t; r++)n += `, ` + w(e[r]);
            return n += `]`, n;
        }
        let n = /\[object ([^\]]+)\]/.exec(toString.call(e)), r;
        if (n && n.length > 1) r = n[1];
        else return toString.call(e);
        if (r == `Object`) try {
            return `Object(` + JSON.stringify(e) + `)`;
        } catch  {
            return `Object`;
        }
        return e instanceof Error ? `${e.name}: ${e.message}\n${e.stack}` : r;
    }
    function T(e, t) {
        if (!(e instanceof t)) throw Error(`expected instance of ${t.name}`);
    }
    var E = 128;
    function D(e) {
        if (E == 1) throw Error(`out of js stack`);
        return o[--E] = e, E;
    }
    function O(e, t) {
        let n = t(e.length * 1, 1) >>> 0;
        return u().set(e, n / 1), c = e.length, n;
    }
    function k(e, t) {
        return e >>>= 0, u().subarray(e / 1, e / 1 + t);
    }
    function A(e, t) {
        e >>>= 0;
        let n = h(), r = [];
        for(let i = e; i < e + 4 * t; i += 4)r.push(b(n.getUint32(i, !0)));
        return r;
    }
    function ne(e, t) {
        try {
            let a = i.__wbindgen_add_to_stack_pointer(-16);
            i.redactJsonUpdates(a, _(e), _(t));
            var n = h().getInt32(a + 0, !0), r = h().getInt32(a + 4, !0);
            if (h().getInt32(a + 8, !0)) throw b(r);
            return b(n);
        } finally{
            i.__wbindgen_add_to_stack_pointer(16);
        }
    }
    function re(e) {
        try {
            let r = i.__wbindgen_add_to_stack_pointer(-16), a = O(e, i.__wbindgen_malloc), o = c;
            i.decodeFrontiers(r, a, o);
            var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
            if (h().getInt32(r + 8, !0)) throw b(n);
            return b(t);
        } finally{
            i.__wbindgen_add_to_stack_pointer(16);
        }
    }
    function j(e, t) {
        let n = t(e.length * 4, 4) >>> 0, r = h();
        for(let t = 0; t < e.length; t++)r.setUint32(n + 4 * t, _(e[t]), !0);
        return c = e.length, n;
    }
    function ie(e) {
        try {
            let o = i.__wbindgen_add_to_stack_pointer(-16), s = j(e, i.__wbindgen_malloc), l = c;
            i.encodeFrontiers(o, s, l);
            var t = h().getInt32(o + 0, !0), n = h().getInt32(o + 4, !0), r = h().getInt32(o + 8, !0);
            if (h().getInt32(o + 12, !0)) throw b(r);
            var a = k(t, n).slice();
            return i.__wbindgen_free(t, n * 1, 1), a;
        } finally{
            i.__wbindgen_add_to_stack_pointer(16);
        }
    }
    function ae(e, t) {
        try {
            let a = i.__wbindgen_add_to_stack_pointer(-16), o = O(e, i.__wbindgen_malloc), s = c;
            i.decodeImportBlobMeta(a, o, s, t);
            var n = h().getInt32(a + 0, !0), r = h().getInt32(a + 4, !0);
            if (h().getInt32(a + 8, !0)) throw b(r);
            return b(n);
        } finally{
            i.__wbindgen_add_to_stack_pointer(16);
        }
    }
    function oe() {
        let e, t;
        try {
            let a = i.__wbindgen_add_to_stack_pointer(-16);
            i.LORO_VERSION(a);
            var n = h().getInt32(a + 0, !0), r = h().getInt32(a + 4, !0);
            return e = n, t = r, y(n, r);
        } finally{
            i.__wbindgen_add_to_stack_pointer(16), i.__wbindgen_free(e, t, 1);
        }
    }
    function se() {
        i.run();
    }
    M = function() {
        i.callPendingEvents();
    };
    function ce() {
        i.setDebug();
    }
    function le(e, t, n) {
        i._dyn_core__ops__function__FnMut__A____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__h23bd7b34cf0bced7(e, t, _(n));
    }
    function ue(e, t) {
        i._dyn_core__ops__function__FnMut_____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__hd82b624f21a7fa96(e, t);
    }
    let de, fe, pe, me, he, N, P, I, L, R, B, H, W, K, J, ge, X, _e, Z, Q;
    de = typeof FinalizationRegistry > `u` ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((e)=>i.__wbg_awarenesswasm_free(e >>> 0, 1));
    fe = class {
        __destroy_into_raw() {
            let e = this.__wbg_ptr;
            return this.__wbg_ptr = 0, de.unregister(this), e;
        }
        free() {
            let e = this.__destroy_into_raw();
            i.__wbg_awarenesswasm_free(e, 0);
        }
        getAllStates() {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.awarenesswasm_getAllStates(n, this.__wbg_ptr);
                var e = h().getInt32(n + 0, !0), t = h().getInt32(n + 4, !0);
                if (h().getInt32(n + 8, !0)) throw b(t);
                return b(e);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        getTimestamp(e) {
            try {
                let a = i.__wbindgen_add_to_stack_pointer(-32);
                i.awarenesswasm_getTimestamp(a, this.__wbg_ptr, _(e));
                var t = h().getInt32(a + 0, !0), n = h().getFloat64(a + 8, !0), r = h().getInt32(a + 16, !0);
                if (h().getInt32(a + 20, !0)) throw b(r);
                return t === 0 ? void 0 : n;
            } finally{
                i.__wbindgen_add_to_stack_pointer(32);
            }
        }
        setLocalState(e) {
            i.awarenesswasm_setLocalState(this.__wbg_ptr, _(e));
        }
        removeOutdated() {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.awarenesswasm_removeOutdated(r, this.__wbg_ptr);
                var e = h().getInt32(r + 0, !0), t = h().getInt32(r + 4, !0), n = A(e, t).slice();
                return i.__wbindgen_free(e, t * 4, 4), n;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        constructor(e, t){
            try {
                let a = i.__wbindgen_add_to_stack_pointer(-16);
                i.awarenesswasm_new(a, _(e), t);
                var n = h().getInt32(a + 0, !0), r = h().getInt32(a + 4, !0);
                if (h().getInt32(a + 8, !0)) throw b(r);
                return this.__wbg_ptr = n >>> 0, de.register(this, this.__wbg_ptr, this), this;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        peer() {
            return b(i.awarenesswasm_peer(this.__wbg_ptr));
        }
        apply(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16), a = O(e, i.__wbindgen_malloc), o = c;
                i.awarenesswasm_apply(r, this.__wbg_ptr, a, o);
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        peers() {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.awarenesswasm_peers(r, this.__wbg_ptr);
                var e = h().getInt32(r + 0, !0), t = h().getInt32(r + 4, !0), n = A(e, t).slice();
                return i.__wbindgen_free(e, t * 4, 4), n;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        encode(e) {
            try {
                let o = i.__wbindgen_add_to_stack_pointer(-16);
                i.awarenesswasm_encode(o, this.__wbg_ptr, _(e));
                var t = h().getInt32(o + 0, !0), n = h().getInt32(o + 4, !0), r = h().getInt32(o + 8, !0);
                if (h().getInt32(o + 12, !0)) throw b(r);
                var a = k(t, n).slice();
                return i.__wbindgen_free(t, n * 1, 1), a;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        length() {
            return i.awarenesswasm_length(this.__wbg_ptr);
        }
        isEmpty() {
            return i.awarenesswasm_isEmpty(this.__wbg_ptr) !== 0;
        }
        getState(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.awarenesswasm_getState(r, this.__wbg_ptr, _(e));
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        encodeAll() {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.awarenesswasm_encodeAll(r, this.__wbg_ptr);
                var e = h().getInt32(r + 0, !0), t = h().getInt32(r + 4, !0), n = k(e, t).slice();
                return i.__wbindgen_free(e, t * 1, 1), n;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
    };
    pe = typeof FinalizationRegistry > `u` ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((e)=>i.__wbg_changemodifier_free(e >>> 0, 1));
    me = class e {
        static __wrap(t) {
            t >>>= 0;
            let n = Object.create(e.prototype);
            return n.__wbg_ptr = t, pe.register(n, n.__wbg_ptr, n), n;
        }
        __destroy_into_raw() {
            let e = this.__wbg_ptr;
            return this.__wbg_ptr = 0, pe.unregister(this), e;
        }
        free() {
            let e = this.__destroy_into_raw();
            i.__wbg_changemodifier_free(e, 0);
        }
        setMessage(t) {
            let n = p(t, i.__wbindgen_malloc, i.__wbindgen_realloc), r = c, a = i.changemodifier_setMessage(this.__wbg_ptr, n, r);
            return e.__wrap(a);
        }
        setTimestamp(t) {
            let n = i.changemodifier_setTimestamp(this.__wbg_ptr, t);
            return e.__wrap(n);
        }
    };
    he = typeof FinalizationRegistry > `u` ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((e)=>i.__wbg_cursor_free(e >>> 0, 1));
    N = class e {
        static __wrap(t) {
            t >>>= 0;
            let n = Object.create(e.prototype);
            return n.__wbg_ptr = t, he.register(n, n.__wbg_ptr, n), n;
        }
        __destroy_into_raw() {
            let e = this.__wbg_ptr;
            return this.__wbg_ptr = 0, he.unregister(this), e;
        }
        free() {
            let e = this.__destroy_into_raw();
            i.__wbg_cursor_free(e, 0);
        }
        containerId() {
            return b(i.cursor_containerId(this.__wbg_ptr));
        }
        pos() {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.cursor_pos(n, this.__wbg_ptr);
                var e = h().getInt32(n + 0, !0), t = h().getInt32(n + 4, !0);
                if (h().getInt32(n + 8, !0)) throw b(t);
                return b(e);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        kind() {
            return b(i.cursor_kind(this.__wbg_ptr));
        }
        side() {
            return b(i.cursor_side(this.__wbg_ptr));
        }
        static decode(t) {
            try {
                let a = i.__wbindgen_add_to_stack_pointer(-16), o = O(t, i.__wbindgen_malloc), s = c;
                i.cursor_decode(a, o, s);
                var n = h().getInt32(a + 0, !0), r = h().getInt32(a + 4, !0);
                if (h().getInt32(a + 8, !0)) throw b(r);
                return e.__wrap(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        encode() {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.cursor_encode(r, this.__wbg_ptr);
                var e = h().getInt32(r + 0, !0), t = h().getInt32(r + 4, !0), n = k(e, t).slice();
                return i.__wbindgen_free(e, t * 1, 1), n;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
    };
    P = typeof FinalizationRegistry > `u` ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((e)=>i.__wbg_ephemeralstorewasm_free(e >>> 0, 1));
    F = class {
        __destroy_into_raw() {
            let e = this.__wbg_ptr;
            return this.__wbg_ptr = 0, P.unregister(this), e;
        }
        free() {
            let e = this.__destroy_into_raw();
            i.__wbg_ephemeralstorewasm_free(e, 0);
        }
        getAllStates() {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.ephemeralstorewasm_getAllStates(n, this.__wbg_ptr);
                var e = h().getInt32(n + 0, !0), t = h().getInt32(n + 4, !0);
                if (h().getInt32(n + 8, !0)) throw b(t);
                return b(e);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        removeOutdated() {
            i.ephemeralstorewasm_removeOutdated(this.__wbg_ptr);
        }
        subscribeLocalUpdates(e) {
            return b(i.ephemeralstorewasm_subscribeLocalUpdates(this.__wbg_ptr, _(e)));
        }
        get(e) {
            let t = p(e, i.__wbindgen_malloc, i.__wbindgen_realloc), n = c;
            return b(i.ephemeralstorewasm_get(this.__wbg_ptr, t, n));
        }
        constructor(e){
            let t = i.ephemeralstorewasm_new(e);
            return this.__wbg_ptr = t >>> 0, P.register(this, this.__wbg_ptr, this), this;
        }
        set(e, t) {
            let n = p(e, i.__wbindgen_malloc, i.__wbindgen_realloc), r = c;
            i.ephemeralstorewasm_set(this.__wbg_ptr, n, r, _(t));
        }
        keys() {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.ephemeralstorewasm_keys(r, this.__wbg_ptr);
                var e = h().getInt32(r + 0, !0), t = h().getInt32(r + 4, !0), n = A(e, t).slice();
                return i.__wbindgen_free(e, t * 4, 4), n;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        apply(e) {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16), r = O(e, i.__wbindgen_malloc), a = c;
                i.ephemeralstorewasm_apply(n, this.__wbg_ptr, r, a);
                var t = h().getInt32(n + 0, !0);
                if (h().getInt32(n + 4, !0)) throw b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        delete(e) {
            let t = p(e, i.__wbindgen_malloc, i.__wbindgen_realloc), n = c;
            i.ephemeralstorewasm_delete(this.__wbg_ptr, t, n);
        }
        encode(e) {
            try {
                let a = i.__wbindgen_add_to_stack_pointer(-16), o = p(e, i.__wbindgen_malloc, i.__wbindgen_realloc), s = c;
                i.ephemeralstorewasm_encode(a, this.__wbg_ptr, o, s);
                var t = h().getInt32(a + 0, !0), n = h().getInt32(a + 4, !0), r = k(t, n).slice();
                return i.__wbindgen_free(t, n * 1, 1), r;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        isEmpty() {
            return i.ephemeralstorewasm_isEmpty(this.__wbg_ptr) !== 0;
        }
        encodeAll() {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.ephemeralstorewasm_encodeAll(r, this.__wbg_ptr);
                var e = h().getInt32(r + 0, !0), t = h().getInt32(r + 4, !0), n = k(e, t).slice();
                return i.__wbindgen_free(e, t * 1, 1), n;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        subscribe(e) {
            return b(i.ephemeralstorewasm_subscribe(this.__wbg_ptr, _(e)));
        }
    };
    I = typeof FinalizationRegistry > `u` ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((e)=>i.__wbg_lorocounter_free(e >>> 0, 1));
    L = class e {
        static __wrap(t) {
            t >>>= 0;
            let n = Object.create(e.prototype);
            return n.__wbg_ptr = t, I.register(n, n.__wbg_ptr, n), n;
        }
        __destroy_into_raw() {
            let e = this.__wbg_ptr;
            return this.__wbg_ptr = 0, I.unregister(this), e;
        }
        free() {
            let e = this.__destroy_into_raw();
            i.__wbg_lorocounter_free(e, 0);
        }
        isAttached() {
            return i.lorocounter_isAttached(this.__wbg_ptr) !== 0;
        }
        getAttached() {
            return b(i.lorocounter_getAttached(this.__wbg_ptr));
        }
        getShallowValue() {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorocounter_getShallowValue(n, this.__wbg_ptr);
                var e = h().getFloat64(n + 0, !0), t = h().getInt32(n + 8, !0);
                if (h().getInt32(n + 12, !0)) throw b(t);
                return e;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        get id() {
            return b(i.lorocounter_id(this.__wbg_ptr));
        }
        constructor(){
            let e = i.lorocounter_new();
            return this.__wbg_ptr = e >>> 0, I.register(this, this.__wbg_ptr, this), this;
        }
        kind() {
            return b(i.lorocounter_kind(this.__wbg_ptr));
        }
        parent() {
            return b(i.lorocounter_parent(this.__wbg_ptr));
        }
        toJSON() {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorocounter_getShallowValue(n, this.__wbg_ptr);
                var e = h().getFloat64(n + 0, !0), t = h().getInt32(n + 8, !0);
                if (h().getInt32(n + 12, !0)) throw b(t);
                return e;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        decrement(e) {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorocounter_decrement(n, this.__wbg_ptr, e);
                var t = h().getInt32(n + 0, !0);
                if (h().getInt32(n + 4, !0)) throw b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        get value() {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorocounter_getShallowValue(n, this.__wbg_ptr);
                var e = h().getFloat64(n + 0, !0), t = h().getInt32(n + 8, !0);
                if (h().getInt32(n + 12, !0)) throw b(t);
                return e;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        increment(e) {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorocounter_increment(n, this.__wbg_ptr, e);
                var t = h().getInt32(n + 0, !0);
                if (h().getInt32(n + 4, !0)) throw b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        subscribe(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorocounter_subscribe(r, this.__wbg_ptr, _(e));
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
    };
    R = typeof FinalizationRegistry > `u` ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((e)=>i.__wbg_lorodoc_free(e >>> 0, 1));
    z = class e {
        static __wrap(t) {
            t >>>= 0;
            let n = Object.create(e.prototype);
            return n.__wbg_ptr = t, R.register(n, n.__wbg_ptr, n), n;
        }
        __destroy_into_raw() {
            let e = this.__wbg_ptr;
            return this.__wbg_ptr = 0, R.unregister(this), e;
        }
        free() {
            let e = this.__destroy_into_raw();
            i.__wbg_lorodoc_free(e, 0);
        }
        applyDiff(e) {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_applyDiff(n, this.__wbg_ptr, _(e));
                var t = h().getInt32(n + 0, !0);
                if (h().getInt32(n + 4, !0)) throw b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        isShallow() {
            return i.lorodoc_isShallow(this.__wbg_ptr) !== 0;
        }
        changeCount() {
            return i.lorodoc_changeCount(this.__wbg_ptr) >>> 0;
        }
        getByPath(e) {
            let t = p(e, i.__wbindgen_malloc, i.__wbindgen_realloc), n = c;
            return b(i.lorodoc_getByPath(this.__wbg_ptr, t, n));
        }
        getCounter(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_getCounter(r, this.__wbg_ptr, D(e));
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return L.__wrap(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16), o[E++] = void 0;
            }
        }
        isDetached() {
            return i.lorodoc_isDetached(this.__wbg_ptr) !== 0;
        }
        get peerIdStr() {
            return b(i.lorodoc_peerIdStr(this.__wbg_ptr));
        }
        setPeerId(e) {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_setPeerId(n, this.__wbg_ptr, _(e));
                var t = h().getInt32(n + 0, !0);
                if (h().getInt32(n + 4, !0)) throw b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        getCursorPos(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                T(e, N), i.lorodoc_getCursorPos(r, this.__wbg_ptr, e.__wbg_ptr);
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        hasContainer(e) {
            return i.lorodoc_hasContainer(this.__wbg_ptr, _(e)) !== 0;
        }
        importBatch(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_importBatch(r, this.__wbg_ptr, _(e));
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        cmpFrontiers(e, t) {
            try {
                let a = i.__wbindgen_add_to_stack_pointer(-16), o = j(e, i.__wbindgen_malloc), s = c, l = j(t, i.__wbindgen_malloc), u = c;
                i.lorodoc_cmpFrontiers(a, this.__wbg_ptr, o, s, l, u);
                var n = h().getInt32(a + 0, !0), r = h().getInt32(a + 4, !0);
                if (h().getInt32(a + 8, !0)) throw b(r);
                return b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        debugHistory() {
            i.lorodoc_debugHistory(this.__wbg_ptr);
        }
        static fromSnapshot(t) {
            try {
                let a = i.__wbindgen_add_to_stack_pointer(-16), o = O(t, i.__wbindgen_malloc), s = c;
                i.lorodoc_fromSnapshot(a, o, s);
                var n = h().getInt32(a + 0, !0), r = h().getInt32(a + 4, !0);
                if (h().getInt32(a + 8, !0)) throw b(r);
                return e.__wrap(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        getChangeAt(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_getChangeAt(r, this.__wbg_ptr, _(e));
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        oplogVersion() {
            let e = i.lorodoc_oplogVersion(this.__wbg_ptr);
            return Q.__wrap(e);
        }
        getMovableList(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_getMovableList(r, this.__wbg_ptr, D(e));
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return G.__wrap(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16), o[E++] = void 0;
            }
        }
        frontiersToVV(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16), a = j(e, i.__wbindgen_malloc), o = c;
                i.lorodoc_frontiersToVV(r, this.__wbg_ptr, a, o);
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return Q.__wrap(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        getAllChanges() {
            return b(i.lorodoc_getAllChanges(this.__wbg_ptr));
        }
        oplogFrontiers() {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_oplogFrontiers(n, this.__wbg_ptr);
                var e = h().getInt32(n + 0, !0), t = h().getInt32(n + 4, !0);
                if (h().getInt32(n + 8, !0)) throw b(t);
                return b(e);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        vvToFrontiers(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                T(e, Q), i.lorodoc_vvToFrontiers(r, this.__wbg_ptr, e.__wbg_ptr);
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        shallowSinceVV() {
            let e = i.lorodoc_shallowSinceVV(this.__wbg_ptr);
            return Q.__wrap(e);
        }
        configTextStyle(e) {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_configTextStyle(n, this.__wbg_ptr, _(e));
                var t = h().getInt32(n + 0, !0);
                if (h().getInt32(n + 4, !0)) throw b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        getOpsInChange(e) {
            try {
                let o = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_getOpsInChange(o, this.__wbg_ptr, _(e));
                var t = h().getInt32(o + 0, !0), n = h().getInt32(o + 4, !0), r = h().getInt32(o + 8, !0);
                if (h().getInt32(o + 12, !0)) throw b(r);
                var a = A(t, n).slice();
                return i.__wbindgen_free(t, n * 4, 4), a;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        getShallowValue() {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_getShallowValue(n, this.__wbg_ptr);
                var e = h().getInt32(n + 0, !0), t = h().getInt32(n + 4, !0);
                if (h().getInt32(n + 8, !0)) throw b(t);
                return b(e);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        checkoutToLatest() {
            try {
                let t = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_checkoutToLatest(t, this.__wbg_ptr);
                var e = h().getInt32(t + 0, !0);
                if (h().getInt32(t + 4, !0)) throw b(e);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        cmpWithFrontiers(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16), a = j(e, i.__wbindgen_malloc), o = c;
                i.lorodoc_cmpWithFrontiers(r, this.__wbg_ptr, a, o);
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return t;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        exportJsonInIdSpan(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_exportJsonInIdSpan(r, this.__wbg_ptr, _(e));
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        subscribeJsonpath(e, t) {
            try {
                let a = i.__wbindgen_add_to_stack_pointer(-16), o = p(e, i.__wbindgen_malloc, i.__wbindgen_realloc), s = c;
                i.lorodoc_subscribeJsonpath(a, this.__wbg_ptr, o, s, _(t));
                var n = h().getInt32(a + 0, !0), r = h().getInt32(a + 4, !0);
                if (h().getInt32(a + 8, !0)) throw b(r);
                return b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        deleteRootContainer(e) {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_deleteRootContainer(n, this.__wbg_ptr, _(e));
                var t = h().getInt32(n + 0, !0);
                if (h().getInt32(n + 4, !0)) throw b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        exportJsonUpdates(e, t, n) {
            try {
                let o = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_exportJsonUpdates(o, this.__wbg_ptr, _(e), _(t), x(n) ? 16777215 : +!!n);
                var r = h().getInt32(o + 0, !0), a = h().getInt32(o + 4, !0);
                if (h().getInt32(o + 8, !0)) throw b(a);
                return b(r);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        getContainerById(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_getContainerById(r, this.__wbg_ptr, _(e));
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        getPendingTxnLength() {
            return i.lorodoc_getPendingTxnLength(this.__wbg_ptr) >>> 0;
        }
        importJsonUpdates(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_importJsonUpdates(r, this.__wbg_ptr, _(e));
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        importUpdateBatch(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_importBatch(r, this.__wbg_ptr, _(e));
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        setDetachedEditing(e) {
            i.lorodoc_setDetachedEditing(this.__wbg_ptr, e);
        }
        setRecordTimestamp(e) {
            i.lorodoc_setRecordTimestamp(this.__wbg_ptr, e);
        }
        subscribePreCommit(e) {
            return b(i.lorodoc_subscribePreCommit(this.__wbg_ptr, _(e)));
        }
        findIdSpansBetween(e, t) {
            try {
                let a = i.__wbindgen_add_to_stack_pointer(-16), o = j(e, i.__wbindgen_malloc), s = c, l = j(t, i.__wbindgen_malloc), u = c;
                i.lorodoc_findIdSpansBetween(a, this.__wbg_ptr, o, s, l, u);
                var n = h().getInt32(a + 0, !0), r = h().getInt32(a + 4, !0);
                if (h().getInt32(a + 8, !0)) throw b(r);
                return b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        getChangeAtLamport(e, t) {
            try {
                let a = i.__wbindgen_add_to_stack_pointer(-16), o = p(e, i.__wbindgen_malloc, i.__wbindgen_realloc), s = c;
                i.lorodoc_getChangeAtLamport(a, this.__wbg_ptr, o, s, t);
                var n = h().getInt32(a + 0, !0), r = h().getInt32(a + 4, !0);
                if (h().getInt32(a + 8, !0)) throw b(r);
                return b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        getPathToContainer(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_getPathToContainer(r, this.__wbg_ptr, _(e));
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        getChangedContainersIn(e, t) {
            try {
                let s = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_getChangedContainersIn(s, this.__wbg_ptr, _(e), t);
                var n = h().getInt32(s + 0, !0), r = h().getInt32(s + 4, !0), a = h().getInt32(s + 8, !0);
                if (h().getInt32(s + 12, !0)) throw b(a);
                var o = A(n, r).slice();
                return i.__wbindgen_free(n, r * 4, 4), o;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        getDeepValueWithID() {
            return b(i.lorodoc_getDeepValueWithID(this.__wbg_ptr));
        }
        setNextCommitOrigin(e) {
            let t = p(e, i.__wbindgen_malloc, i.__wbindgen_realloc), n = c;
            i.lorodoc_setNextCommitOrigin(this.__wbg_ptr, t, n);
        }
        getUncommittedOpsAsJson() {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_getUncommittedOpsAsJson(n, this.__wbg_ptr);
                var e = h().getInt32(n + 0, !0), t = h().getInt32(n + 4, !0);
                if (h().getInt32(n + 8, !0)) throw b(t);
                return b(e);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        setNextCommitMessage(e) {
            let t = p(e, i.__wbindgen_malloc, i.__wbindgen_realloc), n = c;
            i.lorodoc_setNextCommitMessage(this.__wbg_ptr, t, n);
        }
        setNextCommitOptions(e) {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_setNextCommitOptions(n, this.__wbg_ptr, _(e));
                var t = h().getInt32(n + 0, !0);
                if (h().getInt32(n + 4, !0)) throw b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        shallowSinceFrontiers() {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_shallowSinceFrontiers(n, this.__wbg_ptr);
                var e = h().getInt32(n + 0, !0), t = h().getInt32(n + 4, !0);
                if (h().getInt32(n + 8, !0)) throw b(t);
                return b(e);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        subscribeLocalUpdates(e) {
            return b(i.lorodoc_subscribeLocalUpdates(this.__wbg_ptr, _(e)));
        }
        travelChangeAncestors(e, t) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16), a = j(e, i.__wbindgen_malloc), o = c;
                i.lorodoc_travelChangeAncestors(r, this.__wbg_ptr, a, o, _(t));
                var n = h().getInt32(r + 0, !0);
                if (h().getInt32(r + 4, !0)) throw b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        clearNextCommitOptions() {
            i.lorodoc_clearNextCommitOptions(this.__wbg_ptr);
        }
        configDefaultTextStyle(e) {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_configDefaultTextStyle(n, this.__wbg_ptr, _(e));
                var t = h().getInt32(n + 0, !0);
                if (h().getInt32(n + 4, !0)) throw b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        setChangeMergeInterval(e) {
            i.lorodoc_setChangeMergeInterval(this.__wbg_ptr, e);
        }
        setNextCommitTimestamp(e) {
            i.lorodoc_setNextCommitTimestamp(this.__wbg_ptr, e);
        }
        setHideEmptyRootContainers(e) {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_setHideEmptyRootContainers(n, this.__wbg_ptr, e);
                var t = h().getInt32(n + 0, !0);
                if (h().getInt32(n + 4, !0)) throw b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        isDetachedEditingEnabled() {
            return i.lorodoc_isDetachedEditingEnabled(this.__wbg_ptr) !== 0;
        }
        subscribeFirstCommitFromPeer(e) {
            return b(i.lorodoc_subscribeFirstCommitFromPeer(this.__wbg_ptr, _(e)));
        }
        constructor(){
            let e = i.lorodoc_new();
            return this.__wbg_ptr = e >>> 0, R.register(this, this.__wbg_ptr, this), this;
        }
        diff(e, t, n) {
            try {
                let o = i.__wbindgen_add_to_stack_pointer(-16), s = j(e, i.__wbindgen_malloc), l = c, u = j(t, i.__wbindgen_malloc), d = c;
                i.lorodoc_diff(o, this.__wbg_ptr, s, l, u, d, x(n) ? 16777215 : +!!n);
                var r = h().getInt32(o + 0, !0), a = h().getInt32(o + 4, !0);
                if (h().getInt32(o + 8, !0)) throw b(a);
                return b(r);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        fork() {
            let t = i.lorodoc_fork(this.__wbg_ptr);
            return e.__wrap(t);
        }
        attach() {
            i.lorodoc_attach(this.__wbg_ptr);
        }
        commit(e) {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_commit(n, this.__wbg_ptr, x(e) ? 0 : _(e));
                var t = h().getInt32(n + 0, !0);
                if (h().getInt32(n + 4, !0)) throw b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        detach() {
            i.lorodoc_detach(this.__wbg_ptr);
        }
        export(e) {
            try {
                let o = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_export(o, this.__wbg_ptr, _(e));
                var t = h().getInt32(o + 0, !0), n = h().getInt32(o + 4, !0), r = h().getInt32(o + 8, !0);
                if (h().getInt32(o + 12, !0)) throw b(r);
                var a = k(t, n).slice();
                return i.__wbindgen_free(t, n * 1, 1), a;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        import(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16), a = O(e, i.__wbindgen_malloc), o = c;
                i.lorodoc_import(r, this.__wbg_ptr, a, o);
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        forkAt(t) {
            try {
                let a = i.__wbindgen_add_to_stack_pointer(-16), o = j(t, i.__wbindgen_malloc), s = c;
                i.lorodoc_forkAt(a, this.__wbg_ptr, o, s);
                var n = h().getInt32(a + 0, !0), r = h().getInt32(a + 4, !0);
                if (h().getInt32(a + 8, !0)) throw b(r);
                return e.__wrap(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        getMap(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_getMap(r, this.__wbg_ptr, D(e));
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return U.__wrap(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16), o[E++] = void 0;
            }
        }
        opCount() {
            return i.lorodoc_opCount(this.__wbg_ptr) >>> 0;
        }
        get peerId() {
            let e = i.lorodoc_peerId(this.__wbg_ptr);
            return BigInt.asUintN(64, e);
        }
        toJSON() {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_toJSON(n, this.__wbg_ptr);
                var e = h().getInt32(n + 0, !0), t = h().getInt32(n + 4, !0);
                if (h().getInt32(n + 8, !0)) throw b(t);
                return b(e);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        version() {
            let e = i.lorodoc_version(this.__wbg_ptr);
            return Q.__wrap(e);
        }
        checkout(e) {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16), r = j(e, i.__wbindgen_malloc), a = c;
                i.lorodoc_checkout(n, this.__wbg_ptr, r, a);
                var t = h().getInt32(n + 0, !0);
                if (h().getInt32(n + 4, !0)) throw b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        getList(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_getList(r, this.__wbg_ptr, D(e));
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return V.__wrap(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16), o[E++] = void 0;
            }
        }
        getText(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_getText(r, this.__wbg_ptr, D(e));
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return q.__wrap(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16), o[E++] = void 0;
            }
        }
        getTree(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_getTree(r, this.__wbg_ptr, D(e));
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return Y.__wrap(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16), o[E++] = void 0;
            }
        }
        frontiers() {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorodoc_frontiers(n, this.__wbg_ptr);
                var e = h().getInt32(n + 0, !0), t = h().getInt32(n + 4, !0);
                if (h().getInt32(n + 8, !0)) throw b(t);
                return b(e);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        JSONPath(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16), a = p(e, i.__wbindgen_malloc, i.__wbindgen_realloc), o = c;
                i.lorodoc_JSONPath(r, this.__wbg_ptr, a, o);
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        revertTo(e) {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16), r = j(e, i.__wbindgen_malloc), a = c;
                i.lorodoc_revertTo(n, this.__wbg_ptr, r, a);
                var t = h().getInt32(n + 0, !0);
                if (h().getInt32(n + 4, !0)) throw b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        subscribe(e) {
            return b(i.lorodoc_subscribe(this.__wbg_ptr, _(e)));
        }
    };
    B = typeof FinalizationRegistry > `u` ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((e)=>i.__wbg_lorolist_free(e >>> 0, 1));
    V = class e {
        static __wrap(t) {
            t >>>= 0;
            let n = Object.create(e.prototype);
            return n.__wbg_ptr = t, B.register(n, n.__wbg_ptr, n), n;
        }
        __destroy_into_raw() {
            let e = this.__wbg_ptr;
            return this.__wbg_ptr = 0, B.unregister(this), e;
        }
        free() {
            let e = this.__destroy_into_raw();
            i.__wbg_lorolist_free(e, 0);
        }
        isAttached() {
            return i.lorolist_isAttached(this.__wbg_ptr) !== 0;
        }
        getAttached() {
            return b(i.lorolist_getAttached(this.__wbg_ptr));
        }
        pushContainer(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorolist_pushContainer(r, this.__wbg_ptr, _(e));
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        insertContainer(e, t) {
            try {
                let a = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorolist_insertContainer(a, this.__wbg_ptr, e, _(t));
                var n = h().getInt32(a + 0, !0), r = h().getInt32(a + 4, !0);
                if (h().getInt32(a + 8, !0)) throw b(r);
                return b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        getShallowValue() {
            return b(i.lorolist_getShallowValue(this.__wbg_ptr));
        }
        get id() {
            return b(i.lorolist_id(this.__wbg_ptr));
        }
        get(e) {
            return b(i.lorolist_get(this.__wbg_ptr, e));
        }
        constructor(){
            let e = i.lorolist_new();
            return this.__wbg_ptr = e >>> 0, B.register(this, this.__wbg_ptr, this), this;
        }
        pop() {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorolist_pop(n, this.__wbg_ptr);
                var e = h().getInt32(n + 0, !0), t = h().getInt32(n + 4, !0);
                if (h().getInt32(n + 8, !0)) throw b(t);
                return b(e);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        kind() {
            return b(i.lorolist_kind(this.__wbg_ptr));
        }
        push(e) {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorolist_push(n, this.__wbg_ptr, _(e));
                var t = h().getInt32(n + 0, !0);
                if (h().getInt32(n + 4, !0)) throw b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        clear() {
            try {
                let t = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorolist_clear(t, this.__wbg_ptr);
                var e = h().getInt32(t + 0, !0);
                if (h().getInt32(t + 4, !0)) throw b(e);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        delete(e, t) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorolist_delete(r, this.__wbg_ptr, e, t);
                var n = h().getInt32(r + 0, !0);
                if (h().getInt32(r + 4, !0)) throw b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        insert(e, t) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorolist_insert(r, this.__wbg_ptr, e, _(t));
                var n = h().getInt32(r + 0, !0);
                if (h().getInt32(r + 4, !0)) throw b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        get length() {
            return i.lorolist_length(this.__wbg_ptr) >>> 0;
        }
        parent() {
            return b(i.lorolist_parent(this.__wbg_ptr));
        }
        getIdAt(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorolist_getIdAt(r, this.__wbg_ptr, e);
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        toJSON() {
            return b(i.lorolist_toJSON(this.__wbg_ptr));
        }
        toArray() {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorolist_toArray(r, this.__wbg_ptr);
                var e = h().getInt32(r + 0, !0), t = h().getInt32(r + 4, !0), n = A(e, t).slice();
                return i.__wbindgen_free(e, t * 4, 4), n;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        getCursor(e, t) {
            let n = i.lorolist_getCursor(this.__wbg_ptr, e, _(t));
            return n === 0 ? void 0 : N.__wrap(n);
        }
        isDeleted() {
            return i.lorolist_isDeleted(this.__wbg_ptr) !== 0;
        }
        subscribe(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorolist_subscribe(r, this.__wbg_ptr, _(e));
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
    };
    H = typeof FinalizationRegistry > `u` ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((e)=>i.__wbg_loromap_free(e >>> 0, 1));
    U = class e {
        static __wrap(t) {
            t >>>= 0;
            let n = Object.create(e.prototype);
            return n.__wbg_ptr = t, H.register(n, n.__wbg_ptr, n), n;
        }
        __destroy_into_raw() {
            let e = this.__wbg_ptr;
            return this.__wbg_ptr = 0, H.unregister(this), e;
        }
        free() {
            let e = this.__destroy_into_raw();
            i.__wbg_loromap_free(e, 0);
        }
        isAttached() {
            return i.loromap_isAttached(this.__wbg_ptr) !== 0;
        }
        getAttached() {
            return b(i.loromap_getAttached(this.__wbg_ptr));
        }
        getLastEditor(e) {
            let t = p(e, i.__wbindgen_malloc, i.__wbindgen_realloc), n = c;
            return b(i.loromap_getLastEditor(this.__wbg_ptr, t, n));
        }
        setContainer(e, t) {
            try {
                let a = i.__wbindgen_add_to_stack_pointer(-16), o = p(e, i.__wbindgen_malloc, i.__wbindgen_realloc), s = c;
                i.loromap_setContainer(a, this.__wbg_ptr, o, s, _(t));
                var n = h().getInt32(a + 0, !0), r = h().getInt32(a + 4, !0);
                if (h().getInt32(a + 8, !0)) throw b(r);
                return b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        getShallowValue() {
            return b(i.loromap_getShallowValue(this.__wbg_ptr));
        }
        getOrCreateContainer(e, t) {
            try {
                let a = i.__wbindgen_add_to_stack_pointer(-16), o = p(e, i.__wbindgen_malloc, i.__wbindgen_realloc), s = c;
                i.loromap_getOrCreateContainer(a, this.__wbg_ptr, o, s, _(t));
                var n = h().getInt32(a + 0, !0), r = h().getInt32(a + 4, !0);
                if (h().getInt32(a + 8, !0)) throw b(r);
                return b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        get id() {
            return b(i.loromap_id(this.__wbg_ptr));
        }
        get(e) {
            let t = p(e, i.__wbindgen_malloc, i.__wbindgen_realloc), n = c;
            return b(i.loromap_get(this.__wbg_ptr, t, n));
        }
        constructor(){
            let e = i.loromap_new();
            return this.__wbg_ptr = e >>> 0, H.register(this, this.__wbg_ptr, this), this;
        }
        keys() {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.loromap_keys(r, this.__wbg_ptr);
                var e = h().getInt32(r + 0, !0), t = h().getInt32(r + 4, !0), n = A(e, t).slice();
                return i.__wbindgen_free(e, t * 4, 4), n;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        kind() {
            return b(i.loromap_kind(this.__wbg_ptr));
        }
        get size() {
            return i.loromap_size(this.__wbg_ptr) >>> 0;
        }
        clear() {
            try {
                let t = i.__wbindgen_add_to_stack_pointer(-16);
                i.loromap_clear(t, this.__wbg_ptr);
                var e = h().getInt32(t + 0, !0);
                if (h().getInt32(t + 4, !0)) throw b(e);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        delete(e) {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16), r = p(e, i.__wbindgen_malloc, i.__wbindgen_realloc), a = c;
                i.loromap_delete(n, this.__wbg_ptr, r, a);
                var t = h().getInt32(n + 0, !0);
                if (h().getInt32(n + 4, !0)) throw b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        set(e, t) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16), a = p(e, i.__wbindgen_malloc, i.__wbindgen_realloc), o = c;
                i.loromap_set(r, this.__wbg_ptr, a, o, _(t));
                var n = h().getInt32(r + 0, !0);
                if (h().getInt32(r + 4, !0)) throw b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        parent() {
            return b(i.loromap_parent(this.__wbg_ptr));
        }
        values() {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.loromap_values(r, this.__wbg_ptr);
                var e = h().getInt32(r + 0, !0), t = h().getInt32(r + 4, !0), n = A(e, t).slice();
                return i.__wbindgen_free(e, t * 4, 4), n;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        entries() {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.loromap_entries(r, this.__wbg_ptr);
                var e = h().getInt32(r + 0, !0), t = h().getInt32(r + 4, !0), n = A(e, t).slice();
                return i.__wbindgen_free(e, t * 4, 4), n;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        toJSON() {
            return b(i.loromap_toJSON(this.__wbg_ptr));
        }
        isDeleted() {
            return i.loromap_isDeleted(this.__wbg_ptr) !== 0;
        }
        subscribe(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.loromap_subscribe(r, this.__wbg_ptr, _(e));
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
    };
    W = typeof FinalizationRegistry > `u` ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((e)=>i.__wbg_loromovablelist_free(e >>> 0, 1));
    G = class e {
        static __wrap(t) {
            t >>>= 0;
            let n = Object.create(e.prototype);
            return n.__wbg_ptr = t, W.register(n, n.__wbg_ptr, n), n;
        }
        __destroy_into_raw() {
            let e = this.__wbg_ptr;
            return this.__wbg_ptr = 0, W.unregister(this), e;
        }
        free() {
            let e = this.__destroy_into_raw();
            i.__wbg_loromovablelist_free(e, 0);
        }
        isAttached() {
            return i.loromovablelist_isAttached(this.__wbg_ptr) !== 0;
        }
        getCreatorAt(e) {
            return b(i.loromovablelist_getCreatorAt(this.__wbg_ptr, e));
        }
        getAttached() {
            return b(i.loromovablelist_getAttached(this.__wbg_ptr));
        }
        setContainer(e, t) {
            try {
                let a = i.__wbindgen_add_to_stack_pointer(-16);
                i.loromovablelist_setContainer(a, this.__wbg_ptr, e, _(t));
                var n = h().getInt32(a + 0, !0), r = h().getInt32(a + 4, !0);
                if (h().getInt32(a + 8, !0)) throw b(r);
                return b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        getLastMoverAt(e) {
            return b(i.loromovablelist_getLastMoverAt(this.__wbg_ptr, e));
        }
        pushContainer(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.loromovablelist_pushContainer(r, this.__wbg_ptr, _(e));
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        getLastEditorAt(e) {
            return b(i.loromovablelist_getLastEditorAt(this.__wbg_ptr, e));
        }
        insertContainer(e, t) {
            try {
                let a = i.__wbindgen_add_to_stack_pointer(-16);
                i.loromovablelist_insertContainer(a, this.__wbg_ptr, e, _(t));
                var n = h().getInt32(a + 0, !0), r = h().getInt32(a + 4, !0);
                if (h().getInt32(a + 8, !0)) throw b(r);
                return b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        getShallowValue() {
            return b(i.loromovablelist_getShallowValue(this.__wbg_ptr));
        }
        get id() {
            return b(i.loromovablelist_id(this.__wbg_ptr));
        }
        get(e) {
            return b(i.loromovablelist_get(this.__wbg_ptr, e));
        }
        move(e, t) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.loromovablelist_move(r, this.__wbg_ptr, e, t);
                var n = h().getInt32(r + 0, !0);
                if (h().getInt32(r + 4, !0)) throw b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        constructor(){
            let e = i.loromovablelist_new();
            return this.__wbg_ptr = e >>> 0, W.register(this, this.__wbg_ptr, this), this;
        }
        pop() {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.loromovablelist_pop(n, this.__wbg_ptr);
                var e = h().getInt32(n + 0, !0), t = h().getInt32(n + 4, !0);
                if (h().getInt32(n + 8, !0)) throw b(t);
                return b(e);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        set(e, t) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.loromovablelist_set(r, this.__wbg_ptr, e, _(t));
                var n = h().getInt32(r + 0, !0);
                if (h().getInt32(r + 4, !0)) throw b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        kind() {
            return b(i.loromovablelist_kind(this.__wbg_ptr));
        }
        push(e) {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.loromovablelist_push(n, this.__wbg_ptr, _(e));
                var t = h().getInt32(n + 0, !0);
                if (h().getInt32(n + 4, !0)) throw b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        clear() {
            try {
                let t = i.__wbindgen_add_to_stack_pointer(-16);
                i.loromovablelist_clear(t, this.__wbg_ptr);
                var e = h().getInt32(t + 0, !0);
                if (h().getInt32(t + 4, !0)) throw b(e);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        delete(e, t) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.loromovablelist_delete(r, this.__wbg_ptr, e, t);
                var n = h().getInt32(r + 0, !0);
                if (h().getInt32(r + 4, !0)) throw b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        insert(e, t) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.loromovablelist_insert(r, this.__wbg_ptr, e, _(t));
                var n = h().getInt32(r + 0, !0);
                if (h().getInt32(r + 4, !0)) throw b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        get length() {
            return i.loromovablelist_length(this.__wbg_ptr) >>> 0;
        }
        parent() {
            return b(i.loromovablelist_parent(this.__wbg_ptr));
        }
        toJSON() {
            return b(i.loromovablelist_toJSON(this.__wbg_ptr));
        }
        toArray() {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.loromovablelist_toArray(r, this.__wbg_ptr);
                var e = h().getInt32(r + 0, !0), t = h().getInt32(r + 4, !0), n = A(e, t).slice();
                return i.__wbindgen_free(e, t * 4, 4), n;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        getCursor(e, t) {
            let n = i.loromovablelist_getCursor(this.__wbg_ptr, e, _(t));
            return n === 0 ? void 0 : N.__wrap(n);
        }
        isDeleted() {
            return i.loromovablelist_isDeleted(this.__wbg_ptr) !== 0;
        }
        subscribe(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.loromovablelist_subscribe(r, this.__wbg_ptr, _(e));
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
    };
    K = typeof FinalizationRegistry > `u` ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((e)=>i.__wbg_lorotext_free(e >>> 0, 1));
    q = class e {
        static __wrap(t) {
            t >>>= 0;
            let n = Object.create(e.prototype);
            return n.__wbg_ptr = t, K.register(n, n.__wbg_ptr, n), n;
        }
        __destroy_into_raw() {
            let e = this.__wbg_ptr;
            return this.__wbg_ptr = 0, K.unregister(this), e;
        }
        free() {
            let e = this.__destroy_into_raw();
            i.__wbg_lorotext_free(e, 0);
        }
        applyDelta(e) {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotext_applyDelta(n, this.__wbg_ptr, _(e));
                var t = h().getInt32(n + 0, !0);
                if (h().getInt32(n + 4, !0)) throw b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        convertPos(e, t, n) {
            let r = p(t, i.__wbindgen_malloc, i.__wbindgen_realloc), a = c, o = p(n, i.__wbindgen_malloc, i.__wbindgen_realloc), s = c;
            return b(i.lorotext_convertPos(this.__wbg_ptr, e, r, a, o, s));
        }
        deleteUtf8(e, t) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotext_deleteUtf8(r, this.__wbg_ptr, e, t);
                var n = h().getInt32(r + 0, !0);
                if (h().getInt32(r + 4, !0)) throw b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        getEditorOf(e) {
            return b(i.lorotext_getEditorOf(this.__wbg_ptr, e));
        }
        insertUtf8(e, t) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16), a = p(t, i.__wbindgen_malloc, i.__wbindgen_realloc), o = c;
                i.lorotext_insertUtf8(r, this.__wbg_ptr, e, a, o);
                var n = h().getInt32(r + 0, !0);
                if (h().getInt32(r + 4, !0)) throw b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        isAttached() {
            return i.lorotext_isAttached(this.__wbg_ptr) !== 0;
        }
        sliceDelta(e, t) {
            try {
                let a = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotext_sliceDelta(a, this.__wbg_ptr, e, t);
                var n = h().getInt32(a + 0, !0), r = h().getInt32(a + 4, !0);
                if (h().getInt32(a + 8, !0)) throw b(r);
                return b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        getAttached() {
            return b(i.lorotext_getAttached(this.__wbg_ptr));
        }
        updateByLine(e, t) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16), a = p(e, i.__wbindgen_malloc, i.__wbindgen_realloc), o = c;
                i.lorotext_updateByLine(r, this.__wbg_ptr, a, o, _(t));
                var n = h().getInt32(r + 0, !0);
                if (h().getInt32(r + 4, !0)) throw b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        sliceDeltaUtf8(e, t) {
            try {
                let a = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotext_sliceDeltaUtf8(a, this.__wbg_ptr, e, t);
                var n = h().getInt32(a + 0, !0), r = h().getInt32(a + 4, !0);
                if (h().getInt32(a + 8, !0)) throw b(r);
                return b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        getShallowValue() {
            let e, t;
            try {
                let a = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotext_getShallowValue(a, this.__wbg_ptr);
                var n = h().getInt32(a + 0, !0), r = h().getInt32(a + 4, !0);
                return e = n, t = r, y(n, r);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16), i.__wbindgen_free(e, t, 1);
            }
        }
        get id() {
            return b(i.lorotext_id(this.__wbg_ptr));
        }
        constructor(){
            let e = i.lorotext_new();
            return this.__wbg_ptr = e >>> 0, K.register(this, this.__wbg_ptr, this), this;
        }
        iter(e) {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotext_iter(n, this.__wbg_ptr, _(e));
                var t = h().getInt32(n + 0, !0);
                if (h().getInt32(n + 4, !0)) throw b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        kind() {
            return b(i.lorotext_kind(this.__wbg_ptr));
        }
        mark(e, t, n) {
            try {
                let a = i.__wbindgen_add_to_stack_pointer(-16), o = p(t, i.__wbindgen_malloc, i.__wbindgen_realloc), s = c;
                i.lorotext_mark(a, this.__wbg_ptr, _(e), o, s, _(n));
                var r = h().getInt32(a + 0, !0);
                if (h().getInt32(a + 4, !0)) throw b(r);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        push(e) {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16), r = p(e, i.__wbindgen_malloc, i.__wbindgen_realloc), a = c;
                i.lorotext_push(n, this.__wbg_ptr, r, a);
                var t = h().getInt32(n + 0, !0);
                if (h().getInt32(n + 4, !0)) throw b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        slice(e, t) {
            let n, r;
            try {
                let d = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotext_slice(d, this.__wbg_ptr, e, t);
                var a = h().getInt32(d + 0, !0), o = h().getInt32(d + 4, !0), s = h().getInt32(d + 8, !0), c = h().getInt32(d + 12, !0), l = a, u = o;
                if (c) throw l = 0, u = 0, b(s);
                return n = l, r = u, y(l, u);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16), i.__wbindgen_free(n, r, 1);
            }
        }
        delete(e, t) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotext_delete(r, this.__wbg_ptr, e, t);
                var n = h().getInt32(r + 0, !0);
                if (h().getInt32(r + 4, !0)) throw b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        insert(e, t) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16), a = p(t, i.__wbindgen_malloc, i.__wbindgen_realloc), o = c;
                i.lorotext_insert(r, this.__wbg_ptr, e, a, o);
                var n = h().getInt32(r + 0, !0);
                if (h().getInt32(r + 4, !0)) throw b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        get length() {
            return i.lorotext_length(this.__wbg_ptr) >>> 0;
        }
        parent() {
            return b(i.lorotext_parent(this.__wbg_ptr));
        }
        splice(e, t, n) {
            let r, a;
            try {
                let m = i.__wbindgen_add_to_stack_pointer(-16), g = p(n, i.__wbindgen_malloc, i.__wbindgen_realloc), _ = c;
                i.lorotext_splice(m, this.__wbg_ptr, e, t, g, _);
                var o = h().getInt32(m + 0, !0), s = h().getInt32(m + 4, !0), l = h().getInt32(m + 8, !0), u = h().getInt32(m + 12, !0), d = o, f = s;
                if (u) throw d = 0, f = 0, b(l);
                return r = d, a = f, y(d, f);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16), i.__wbindgen_free(r, a, 1);
            }
        }
        unmark(e, t) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16), a = p(t, i.__wbindgen_malloc, i.__wbindgen_realloc), o = c;
                i.lorotext_unmark(r, this.__wbg_ptr, _(e), a, o);
                var n = h().getInt32(r + 0, !0);
                if (h().getInt32(r + 4, !0)) throw b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        update(e, t) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16), a = p(e, i.__wbindgen_malloc, i.__wbindgen_realloc), o = c;
                i.lorotext_update(r, this.__wbg_ptr, a, o, _(t));
                var n = h().getInt32(r + 0, !0);
                if (h().getInt32(r + 4, !0)) throw b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        charAt(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotext_charAt(r, this.__wbg_ptr, e);
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return String.fromCodePoint(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        toJSON() {
            return b(i.lorotext_toJSON(this.__wbg_ptr));
        }
        toDelta() {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotext_toDelta(n, this.__wbg_ptr);
                var e = h().getInt32(n + 0, !0), t = h().getInt32(n + 4, !0);
                if (h().getInt32(n + 8, !0)) throw b(t);
                return b(e);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        getCursor(e, t) {
            let n = i.lorotext_getCursor(this.__wbg_ptr, e, _(t));
            return n === 0 ? void 0 : N.__wrap(n);
        }
        isDeleted() {
            return i.lorotext_isDeleted(this.__wbg_ptr) !== 0;
        }
        subscribe(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotext_subscribe(r, this.__wbg_ptr, _(e));
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        toString() {
            let e, t;
            try {
                let a = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotext_toString(a, this.__wbg_ptr);
                var n = h().getInt32(a + 0, !0), r = h().getInt32(a + 4, !0);
                return e = n, t = r, y(n, r);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16), i.__wbindgen_free(e, t, 1);
            }
        }
    };
    J = typeof FinalizationRegistry > `u` ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((e)=>i.__wbg_lorotree_free(e >>> 0, 1));
    Y = class e {
        static __wrap(t) {
            t >>>= 0;
            let n = Object.create(e.prototype);
            return n.__wbg_ptr = t, J.register(n, n.__wbg_ptr, n), n;
        }
        __destroy_into_raw() {
            let e = this.__wbg_ptr;
            return this.__wbg_ptr = 0, J.unregister(this), e;
        }
        free() {
            let e = this.__destroy_into_raw();
            i.__wbg_lorotree_free(e, 0);
        }
        createNode(e, t) {
            try {
                let a = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotree_createNode(a, this.__wbg_ptr, D(e), x(t) ? 4294967297 : t >>> 0);
                var n = h().getInt32(a + 0, !0), r = h().getInt32(a + 4, !0);
                if (h().getInt32(a + 8, !0)) throw b(r);
                return X.__wrap(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16), o[E++] = void 0;
            }
        }
        isAttached() {
            return i.lorotree_isAttached(this.__wbg_ptr) !== 0;
        }
        getAttached() {
            return b(i.lorotree_getAttached(this.__wbg_ptr));
        }
        getNodeByID(e) {
            try {
                let t = i.lorotree_getNodeByID(this.__wbg_ptr, D(e));
                return t === 0 ? void 0 : X.__wrap(t);
            } finally{
                o[E++] = void 0;
            }
        }
        isNodeDeleted(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotree_isNodeDeleted(r, this.__wbg_ptr, D(e));
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return t !== 0;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16), o[E++] = void 0;
            }
        }
        getShallowValue() {
            return b(i.lorotree_getShallowValue(this.__wbg_ptr));
        }
        enableFractionalIndex(e) {
            i.lorotree_enableFractionalIndex(this.__wbg_ptr, e);
        }
        disableFractionalIndex() {
            i.lorotree_disableFractionalIndex(this.__wbg_ptr);
        }
        isFractionalIndexEnabled() {
            return i.lorotree_isFractionalIndexEnabled(this.__wbg_ptr) !== 0;
        }
        get id() {
            return b(i.lorotree_id(this.__wbg_ptr));
        }
        move(e, t, n) {
            try {
                let a = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotree_move(a, this.__wbg_ptr, D(e), D(t), x(n) ? 4294967297 : n >>> 0);
                var r = h().getInt32(a + 0, !0);
                if (h().getInt32(a + 4, !0)) throw b(r);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16), o[E++] = void 0, o[E++] = void 0;
            }
        }
        constructor(){
            let e = i.lorotree_new();
            return this.__wbg_ptr = e >>> 0, J.register(this, this.__wbg_ptr, this), this;
        }
        kind() {
            return b(i.lorotree_kind(this.__wbg_ptr));
        }
        nodes() {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotree_nodes(r, this.__wbg_ptr);
                var e = h().getInt32(r + 0, !0), t = h().getInt32(r + 4, !0), n = A(e, t).slice();
                return i.__wbindgen_free(e, t * 4, 4), n;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        roots() {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotree_roots(r, this.__wbg_ptr);
                var e = h().getInt32(r + 0, !0), t = h().getInt32(r + 4, !0), n = A(e, t).slice();
                return i.__wbindgen_free(e, t * 4, 4), n;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        delete(e) {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotree_delete(n, this.__wbg_ptr, D(e));
                var t = h().getInt32(n + 0, !0);
                if (h().getInt32(n + 4, !0)) throw b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16), o[E++] = void 0;
            }
        }
        parent() {
            return b(i.lorotree_parent(this.__wbg_ptr));
        }
        toJSON() {
            return b(i.lorotree_toJSON(this.__wbg_ptr));
        }
        has(e) {
            try {
                return i.lorotree_has(this.__wbg_ptr, D(e)) !== 0;
            } finally{
                o[E++] = void 0;
            }
        }
        toArray() {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotree_toArray(n, this.__wbg_ptr);
                var e = h().getInt32(n + 0, !0), t = h().getInt32(n + 4, !0);
                if (h().getInt32(n + 8, !0)) throw b(t);
                return b(e);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        getNodes(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotree_getNodes(r, this.__wbg_ptr, _(e));
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        isDeleted() {
            return i.lorotree_isDeleted(this.__wbg_ptr) !== 0;
        }
        subscribe(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotree_subscribe(r, this.__wbg_ptr, _(e));
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
    };
    ge = typeof FinalizationRegistry > `u` ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((e)=>i.__wbg_lorotreenode_free(e >>> 0, 1));
    X = class e {
        static __wrap(t) {
            t >>>= 0;
            let n = Object.create(e.prototype);
            return n.__wbg_ptr = t, ge.register(n, n.__wbg_ptr, n), n;
        }
        __destroy_into_raw() {
            let e = this.__wbg_ptr;
            return this.__wbg_ptr = 0, ge.unregister(this), e;
        }
        free() {
            let e = this.__destroy_into_raw();
            i.__wbg_lorotreenode_free(e, 0);
        }
        creationId() {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotreenode_creationId(n, this.__wbg_ptr);
                var e = h().getInt32(n + 0, !0), t = h().getInt32(n + 4, !0);
                if (h().getInt32(n + 8, !0)) throw b(t);
                return b(e);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        isDeleted() {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotreenode_isDeleted(n, this.__wbg_ptr);
                var e = h().getInt32(n + 0, !0), t = h().getInt32(n + 4, !0);
                if (h().getInt32(n + 8, !0)) throw b(t);
                return e !== 0;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        moveBefore(t) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                T(t, e), i.lorotreenode_moveBefore(r, this.__wbg_ptr, t.__wbg_ptr);
                var n = h().getInt32(r + 0, !0);
                if (h().getInt32(r + 4, !0)) throw b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        createNode(t) {
            try {
                let a = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotreenode_createNode(a, this.__wbg_ptr, x(t) ? 4294967297 : t >>> 0);
                var n = h().getInt32(a + 0, !0), r = h().getInt32(a + 4, !0);
                if (h().getInt32(a + 8, !0)) throw b(r);
                return e.__wrap(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        getLastMoveId() {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotreenode_getLastMoveId(n, this.__wbg_ptr);
                var e = h().getInt32(n + 0, !0), t = h().getInt32(n + 4, !0);
                if (h().getInt32(n + 8, !0)) throw b(t);
                return b(e);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        toJSON() {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotreenode_toJSON(n, this.__wbg_ptr);
                var e = h().getInt32(n + 0, !0), t = h().getInt32(n + 4, !0);
                if (h().getInt32(n + 8, !0)) throw b(t);
                return b(e);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        fractionalIndex() {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotreenode_fractionalIndex(n, this.__wbg_ptr);
                var e = h().getInt32(n + 0, !0), t = h().getInt32(n + 4, !0);
                if (h().getInt32(n + 8, !0)) throw b(t);
                return b(e);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        __getClassname() {
            let e, t;
            try {
                let a = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotreenode___getClassname(a, this.__wbg_ptr);
                var n = h().getInt32(a + 0, !0), r = h().getInt32(a + 4, !0);
                return e = n, t = r, y(n, r);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16), i.__wbindgen_free(e, t, 1);
            }
        }
        get id() {
            return b(i.lorotreenode_id(this.__wbg_ptr));
        }
        move(e, t) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotreenode_move(r, this.__wbg_ptr, D(e), x(t) ? 4294967297 : t >>> 0);
                var n = h().getInt32(r + 0, !0);
                if (h().getInt32(r + 4, !0)) throw b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16), o[E++] = void 0;
            }
        }
        get data() {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotreenode_data(n, this.__wbg_ptr);
                var e = h().getInt32(n + 0, !0), t = h().getInt32(n + 4, !0);
                if (h().getInt32(n + 8, !0)) throw b(t);
                return U.__wrap(e);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        index() {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotreenode_index(n, this.__wbg_ptr);
                var e = h().getFloat64(n + 0, !0), t = h().getInt32(n + 8, !0);
                if (h().getInt32(n + 12, !0)) throw b(t);
                return e === 4294967297 ? void 0 : e;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        parent() {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.lorotreenode_parent(r, this.__wbg_ptr);
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return t === 0 ? void 0 : e.__wrap(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        creator() {
            return b(i.lorotreenode_creator(this.__wbg_ptr));
        }
        children() {
            return b(i.lorotreenode_children(this.__wbg_ptr));
        }
        moveAfter(t) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                T(t, e), i.lorotreenode_moveAfter(r, this.__wbg_ptr, t.__wbg_ptr);
                var n = h().getInt32(r + 0, !0);
                if (h().getInt32(r + 4, !0)) throw b(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
    };
    _e = typeof FinalizationRegistry > `u` ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((e)=>i.__wbg_undomanager_free(e >>> 0, 1));
    ve = class {
        __destroy_into_raw() {
            let e = this.__wbg_ptr;
            return this.__wbg_ptr = 0, _e.unregister(this), e;
        }
        free() {
            let e = this.__destroy_into_raw();
            i.__wbg_undomanager_free(e, 0);
        }
        groupStart() {
            try {
                let t = i.__wbindgen_add_to_stack_pointer(-16);
                i.undomanager_groupStart(t, this.__wbg_ptr);
                var e = h().getInt32(t + 0, !0);
                if (h().getInt32(t + 4, !0)) throw b(e);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        topRedoValue() {
            return b(i.undomanager_topRedoValue(this.__wbg_ptr));
        }
        topUndoValue() {
            return b(i.undomanager_topUndoValue(this.__wbg_ptr));
        }
        setMaxUndoSteps(e) {
            i.undomanager_setMaxUndoSteps(this.__wbg_ptr, e);
        }
        setMergeInterval(e) {
            i.undomanager_setMergeInterval(this.__wbg_ptr, e);
        }
        addExcludeOriginPrefix(e) {
            let t = p(e, i.__wbindgen_malloc, i.__wbindgen_realloc), n = c;
            i.undomanager_addExcludeOriginPrefix(this.__wbg_ptr, t, n);
        }
        constructor(e, t){
            T(e, z);
            let n = i.undomanager_new(e.__wbg_ptr, _(t));
            return this.__wbg_ptr = n >>> 0, _e.register(this, this.__wbg_ptr, this), this;
        }
        peer() {
            return b(i.undomanager_peer(this.__wbg_ptr));
        }
        redo() {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.undomanager_redo(n, this.__wbg_ptr);
                var e = h().getInt32(n + 0, !0), t = h().getInt32(n + 4, !0);
                if (h().getInt32(n + 8, !0)) throw b(t);
                return e !== 0;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        undo() {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.undomanager_undo(n, this.__wbg_ptr);
                var e = h().getInt32(n + 0, !0), t = h().getInt32(n + 4, !0);
                if (h().getInt32(n + 8, !0)) throw b(t);
                return e !== 0;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        clear() {
            i.undomanager_clear(this.__wbg_ptr);
        }
        canRedo() {
            return i.undomanager_canRedo(this.__wbg_ptr) !== 0;
        }
        canUndo() {
            return i.undomanager_canUndo(this.__wbg_ptr) !== 0;
        }
        groupEnd() {
            i.undomanager_groupEnd(this.__wbg_ptr);
        }
        setOnPop(e) {
            i.undomanager_setOnPop(this.__wbg_ptr, _(e));
        }
        clearRedo() {
            i.undomanager_clearRedo(this.__wbg_ptr);
        }
        clearUndo() {
            i.undomanager_clearUndo(this.__wbg_ptr);
        }
        setOnPush(e) {
            i.undomanager_setOnPush(this.__wbg_ptr, _(e));
        }
    };
    Z = typeof FinalizationRegistry > `u` ? {
        register: ()=>{},
        unregister: ()=>{}
    } : new FinalizationRegistry((e)=>i.__wbg_versionvector_free(e >>> 0, 1));
    Q = class e {
        static __wrap(t) {
            t >>>= 0;
            let n = Object.create(e.prototype);
            return n.__wbg_ptr = t, Z.register(n, n.__wbg_ptr, n), n;
        }
        __destroy_into_raw() {
            let e = this.__wbg_ptr;
            return this.__wbg_ptr = 0, Z.unregister(this), e;
        }
        free() {
            let e = this.__destroy_into_raw();
            i.__wbg_versionvector_free(e, 0);
        }
        get(e) {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.versionvector_get(r, this.__wbg_ptr, _(e));
                var t = h().getFloat64(r + 0, !0), n = h().getInt32(r + 8, !0);
                if (h().getInt32(r + 12, !0)) throw b(n);
                return t === 4294967297 ? void 0 : t;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        constructor(e){
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.versionvector_new(r, _(e));
                var t = h().getInt32(r + 0, !0), n = h().getInt32(r + 4, !0);
                if (h().getInt32(r + 8, !0)) throw b(n);
                return this.__wbg_ptr = t >>> 0, Z.register(this, this.__wbg_ptr, this), this;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        static decode(t) {
            try {
                let a = i.__wbindgen_add_to_stack_pointer(-16), o = O(t, i.__wbindgen_malloc), s = c;
                i.versionvector_decode(a, o, s);
                var n = h().getInt32(a + 0, !0), r = h().getInt32(a + 4, !0);
                if (h().getInt32(a + 8, !0)) throw b(r);
                return e.__wrap(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        encode() {
            try {
                let r = i.__wbindgen_add_to_stack_pointer(-16);
                i.versionvector_encode(r, this.__wbg_ptr);
                var e = h().getInt32(r + 0, !0), t = h().getInt32(r + 4, !0), n = k(e, t).slice();
                return i.__wbindgen_free(e, t * 1, 1), n;
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        length() {
            return i.versionvector_length(this.__wbg_ptr) >>> 0;
        }
        remove(e) {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.versionvector_remove(n, this.__wbg_ptr, _(e));
                var t = h().getInt32(n + 0, !0);
                if (h().getInt32(n + 4, !0)) throw b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        setEnd(e) {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.versionvector_setEnd(n, this.__wbg_ptr, _(e));
                var t = h().getInt32(n + 0, !0);
                if (h().getInt32(n + 4, !0)) throw b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        compare(t) {
            T(t, e);
            let n = i.versionvector_compare(this.__wbg_ptr, t.__wbg_ptr);
            return n === 4294967297 ? void 0 : n;
        }
        setLast(e) {
            try {
                let n = i.__wbindgen_add_to_stack_pointer(-16);
                i.versionvector_setLast(n, this.__wbg_ptr, _(e));
                var t = h().getInt32(n + 0, !0);
                if (h().getInt32(n + 4, !0)) throw b(t);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
        toJSON() {
            return b(i.versionvector_toJSON(this.__wbg_ptr));
        }
        static parseJSON(t) {
            try {
                let a = i.__wbindgen_add_to_stack_pointer(-16);
                i.versionvector_parseJSON(a, _(t));
                var n = h().getInt32(a + 0, !0), r = h().getInt32(a + 4, !0);
                if (h().getInt32(a + 8, !0)) throw b(r);
                return e.__wrap(n);
            } finally{
                i.__wbindgen_add_to_stack_pointer(16);
            }
        }
    };
    function ye(e, t) {
        let n = p(String(s(t)), i.__wbindgen_malloc, i.__wbindgen_realloc), r = c;
        h().setInt32(e + 4, r, !0), h().setInt32(e + 0, n, !0);
    }
    function be() {
        return v(function(e, t, n) {
            return _(s(e).apply(s(t), s(n)));
        }, arguments);
    }
    function xe() {
        return v(function(e, t, n) {
            return _(Reflect.apply(s(e), s(t), s(n)));
        }, arguments);
    }
    function Se(e) {
        let t = s(e).buffer;
        return _(t);
    }
    function Ce() {
        return v(function(e, t) {
            return _(s(e).call(s(t)));
        }, arguments);
    }
    function we() {
        return v(function(e, t, n) {
            return _(s(e).call(s(t), s(n)));
        }, arguments);
    }
    function Te() {
        return v(function(e, t, n, r) {
            return _(s(e).call(s(t), s(n), s(r)));
        }, arguments);
    }
    function Ee() {
        return v(function(e, t, n, r, i) {
            return _(s(e).call(s(t), s(n), s(r), s(i)));
        }, arguments);
    }
    function De(e) {
        return _(me.__wrap(e));
    }
    function Oe(e) {
        let t = s(e).crypto;
        return _(t);
    }
    function ke(e) {
        return _(N.__wrap(e));
    }
    function Ae(e) {
        return s(e).done;
    }
    function je(e) {
        return _(Object.entries(s(e)));
    }
    function Me(e) {
        return _(s(e).entries());
    }
    function Ne(e, t) {
        let n, r;
        try {
            n = e, r = t, console.error(y(e, t));
        } finally{
            i.__wbindgen_free(n, r, 1);
        }
    }
    function Pe(e, t) {
        console.error(y(e, t));
    }
    function Fe(e) {
        return _(Array.from(s(e)));
    }
    function Ie(e) {
        return _(Object.getOwnPropertySymbols(s(e)));
    }
    function Le() {
        return v(function(e, t) {
            s(e).getRandomValues(s(t));
        }, arguments);
    }
    function Re() {
        return v(function(e, t) {
            return _(Reflect.get(s(e), s(t)));
        }, arguments);
    }
    function ze(e, t) {
        let n = s(e)[t >>> 0];
        return _(n);
    }
    function Be(e, t) {
        return s(e)[t >>> 0];
    }
    function Ve(e, t) {
        let n = s(e)[s(t)];
        return _(n);
    }
    function He(e) {
        let t;
        try {
            t = s(e) instanceof ArrayBuffer;
        } catch  {
            t = !1;
        }
        return t;
    }
    function Ue(e) {
        let t;
        try {
            t = s(e) instanceof Map;
        } catch  {
            t = !1;
        }
        return t;
    }
    function We(e) {
        let t;
        try {
            t = s(e) instanceof Object;
        } catch  {
            t = !1;
        }
        return t;
    }
    function Ge(e) {
        let t;
        try {
            t = s(e) instanceof Uint8Array;
        } catch  {
            t = !1;
        }
        return t;
    }
    function Ke(e) {
        return Array.isArray(s(e));
    }
    function qe(e) {
        return Number.isSafeInteger(s(e));
    }
    function Je() {
        let e = Symbol.iterator;
        return _(e);
    }
    function Ye(e) {
        return s(e).length;
    }
    function Xe(e) {
        return s(e).length;
    }
    function Ze(e, t, n, r, a, o, s, c) {
        let l, u;
        try {
            l = e, u = t, console.log(y(e, t), y(n, r), y(a, o), y(s, c));
        } finally{
            i.__wbindgen_free(l, u, 1);
        }
    }
    function Qe(e, t) {
        console.log(y(e, t));
    }
    function $e(e, t) {
        let n, r;
        try {
            n = e, r = t, console.log(y(e, t));
        } finally{
            i.__wbindgen_free(n, r, 1);
        }
    }
    function et(e) {
        return _(L.__wrap(e));
    }
    function tt(e) {
        return _(V.__wrap(e));
    }
    function nt(e) {
        return _(U.__wrap(e));
    }
    function rt(e) {
        return _(G.__wrap(e));
    }
    function it(e) {
        return _(q.__wrap(e));
    }
    function at(e) {
        return _(Y.__wrap(e));
    }
    function ot(e) {
        return _(X.__wrap(e));
    }
    function st(e, t) {
        performance.mark(y(e, t));
    }
    function ct() {
        return v(function(e, t, n, r) {
            let a, o, s, c;
            try {
                a = e, o = t, s = n, c = r, performance.measure(y(e, t), y(n, r));
            } finally{
                i.__wbindgen_free(a, o, 1), i.__wbindgen_free(s, c, 1);
            }
        }, arguments);
    }
    function lt(e) {
        let t = s(e).msCrypto;
        return _(t);
    }
    function ut() {
        return _({});
    }
    function dt() {
        return _(new Map);
    }
    function ft() {
        return _([]);
    }
    function pt() {
        return _(Error());
    }
    function mt(e) {
        return _(new Uint8Array(s(e)));
    }
    function ht(e, t) {
        return _(Function(y(e, t)));
    }
    function gt(e, t, n) {
        return _(new Uint8Array(s(e), t >>> 0, n >>> 0));
    }
    function _t(e) {
        return _(new Uint8Array(e >>> 0));
    }
    function vt(e) {
        return _(Array(e >>> 0));
    }
    function yt(e) {
        let t = s(e).next;
        return _(t);
    }
    function bt() {
        return v(function(e) {
            return _(s(e).next());
        }, arguments);
    }
    function xt(e) {
        let t = s(e).node;
        return _(t);
    }
    function St() {
        return Date.now();
    }
    function Ct() {
        return v(function(e) {
            return _(Reflect.ownKeys(s(e)));
        }, arguments);
    }
    function wt(e) {
        let t = s(e).process;
        return _(t);
    }
    function Tt(e, t) {
        return s(e).push(s(t));
    }
    function Et() {
        return v(function(e, t) {
            s(e).randomFillSync(b(t));
        }, arguments);
    }
    function Dt() {
        return v(function() {
            let e = module.require;
            return _(e);
        }, arguments);
    }
    function Ot(e) {
        return _(Promise.resolve(s(e)));
    }
    function kt(e, t, n) {
        s(e)[t >>> 0] = b(n);
    }
    function At(e, t, n) {
        s(e)[b(t)] = b(n);
    }
    function jt(e, t, n) {
        s(e).set(s(t), n >>> 0);
    }
    function Mt(e, t, n) {
        return _(s(e).set(s(t), s(n)));
    }
    function Nt() {
        return v(function(e, t, n) {
            return Reflect.set(s(e), s(t), s(n));
        }, arguments);
    }
    function Pt(e, t, n) {
        s(e)[t >>> 0] = n;
    }
    function Ft(e, t) {
        let n = s(t).stack, r = p(n, i.__wbindgen_malloc, i.__wbindgen_realloc), a = c;
        h().setInt32(e + 4, a, !0), h().setInt32(e + 0, r, !0);
    }
    function It() {
        let e = typeof global > `u` ? null : global;
        return x(e) ? 0 : _(e);
    }
    function Lt() {
        let e = typeof globalThis > `u` ? null : globalThis;
        return x(e) ? 0 : _(e);
    }
    function Rt() {
        let e = typeof self > `u` ? null : self;
        return x(e) ? 0 : _(e);
    }
    function zt() {
        let e = typeof window > `u` ? null : window;
        return x(e) ? 0 : _(e);
    }
    function Bt(e, t, n) {
        return _(s(e).subarray(t >>> 0, n >>> 0));
    }
    function Vt(e, t) {
        return _(s(e).then(s(t)));
    }
    function Ht(e) {
        let t = s(e).value;
        return _(t);
    }
    function Ut(e) {
        let t = s(e).versions;
        return _(t);
    }
    function Wt(e) {
        return _(Q.__wrap(e));
    }
    function Gt(e, t) {
        console.warn(y(e, t));
    }
    function Kt(e) {
        return +s(e);
    }
    function qt(e) {
        return _(e);
    }
    function Jt(e) {
        return _(BigInt.asUintN(64, e));
    }
    function Yt(e, t) {
        let n = s(t), r = typeof n == `bigint` ? n : void 0;
        h().setBigInt64(e + 8, x(r) ? BigInt(0) : r, !0), h().setInt32(e + 0, !x(r), !0);
    }
    function Xt(e) {
        let t = s(e);
        return typeof t == `boolean` ? +!!t : 2;
    }
    function Zt(e) {
        let t = b(e).original;
        return t.cnt-- == 1 ? (t.a = 0, !0) : !1;
    }
    function Qt(e, t, n) {
        return _(C(e, t, 10, le));
    }
    function $t(e, t, n) {
        return _(C(e, t, 10, ue));
    }
    function en(e, t) {
        let n = p(w(s(t)), i.__wbindgen_malloc, i.__wbindgen_realloc), r = c;
        h().setInt32(e + 4, r, !0), h().setInt32(e + 0, n, !0);
    }
    function tn(e, t) {
        return _(Error(y(e, t)));
    }
    function nn(e, t) {
        return s(e) in s(t);
    }
    function rn(e) {
        return Array.isArray(s(e));
    }
    function an(e) {
        return typeof s(e) == `bigint`;
    }
    function on(e) {
        return !s(e);
    }
    function sn(e) {
        return typeof s(e) == `function`;
    }
    function cn(e) {
        return s(e) === null;
    }
    function ln(e) {
        let t = s(e);
        return typeof t == `object` && !!t;
    }
    function un(e) {
        return typeof s(e) == `string`;
    }
    function dn(e) {
        return s(e) === void 0;
    }
    function fn(e, t) {
        return s(e) === s(t);
    }
    function pn(e, t) {
        return s(e) == s(t);
    }
    function mn() {
        let e = i.memory;
        return _(e);
    }
    function hn(e, t) {
        let n = s(t), r = typeof n == `number` ? n : void 0;
        h().setFloat64(e + 8, x(r) ? 0 : r, !0), h().setInt32(e + 0, !x(r), !0);
    }
    function gn(e) {
        return _(e);
    }
    function _n(e) {
        return _(s(e));
    }
    function vn(e) {
        b(e);
    }
    function yn(e) {
        throw b(e);
    }
    function bn(e, t) {
        let n = s(t), r = typeof n == `string` ? n : void 0;
        var a = x(r) ? 0 : p(r, i.__wbindgen_malloc, i.__wbindgen_realloc), o = c;
        h().setInt32(e + 4, o, !0), h().setInt32(e + 0, a, !0);
    }
    function xn(e, t) {
        return _(y(e, t));
    }
    function Sn(e, t) {
        throw Error(y(e, t));
    }
    function Cn(e) {
        return _(typeof s(e));
    }
    wn = e({
        LORO_VERSION: ()=>En,
        __wbg_awarenesswasm_free: ()=>Dn,
        __wbg_changemodifier_free: ()=>On,
        __wbg_cursor_free: ()=>kn,
        __wbg_ephemeralstorewasm_free: ()=>An,
        __wbg_lorocounter_free: ()=>jn,
        __wbg_lorodoc_free: ()=>Mn,
        __wbg_lorolist_free: ()=>Nn,
        __wbg_loromap_free: ()=>Pn,
        __wbg_loromovablelist_free: ()=>gc,
        __wbg_lorotext_free: ()=>Fn,
        __wbg_lorotree_free: ()=>In,
        __wbg_lorotreenode_free: ()=>Ln,
        __wbg_undomanager_free: ()=>Rn,
        __wbg_versionvector_free: ()=>zn,
        __wbindgen_add_to_stack_pointer: ()=>wc,
        __wbindgen_exn_store: ()=>xc,
        __wbindgen_export_4: ()=>Cc,
        __wbindgen_free: ()=>Sc,
        __wbindgen_malloc: ()=>yc,
        __wbindgen_realloc: ()=>bc,
        __wbindgen_start: ()=>Dc,
        _dyn_core__ops__function__FnMut__A____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__h23bd7b34cf0bced7: ()=>Tc,
        _dyn_core__ops__function__FnMut_____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__hd82b624f21a7fa96: ()=>Ec,
        awarenesswasm_apply: ()=>Bn,
        awarenesswasm_encode: ()=>Vn,
        awarenesswasm_encodeAll: ()=>Hn,
        awarenesswasm_getAllStates: ()=>Un,
        awarenesswasm_getState: ()=>Wn,
        awarenesswasm_getTimestamp: ()=>Gn,
        awarenesswasm_isEmpty: ()=>Kn,
        awarenesswasm_length: ()=>qn,
        awarenesswasm_new: ()=>Jn,
        awarenesswasm_peer: ()=>Yn,
        awarenesswasm_peers: ()=>Xn,
        awarenesswasm_removeOutdated: ()=>Zn,
        awarenesswasm_setLocalState: ()=>Qn,
        callPendingEvents: ()=>$n,
        changemodifier_setMessage: ()=>er,
        changemodifier_setTimestamp: ()=>tr,
        cursor_containerId: ()=>nr,
        cursor_decode: ()=>rr,
        cursor_encode: ()=>ir,
        cursor_kind: ()=>ar,
        cursor_pos: ()=>or,
        cursor_side: ()=>sr,
        decodeFrontiers: ()=>cr,
        decodeImportBlobMeta: ()=>lr,
        encodeFrontiers: ()=>ur,
        ephemeralstorewasm_apply: ()=>dr,
        ephemeralstorewasm_delete: ()=>fr,
        ephemeralstorewasm_encode: ()=>pr,
        ephemeralstorewasm_encodeAll: ()=>mr,
        ephemeralstorewasm_get: ()=>hr,
        ephemeralstorewasm_getAllStates: ()=>gr,
        ephemeralstorewasm_isEmpty: ()=>_r,
        ephemeralstorewasm_keys: ()=>vr,
        ephemeralstorewasm_new: ()=>yr,
        ephemeralstorewasm_removeOutdated: ()=>br,
        ephemeralstorewasm_set: ()=>xr,
        ephemeralstorewasm_subscribe: ()=>Sr,
        ephemeralstorewasm_subscribeLocalUpdates: ()=>Cr,
        lorocounter_decrement: ()=>wr,
        lorocounter_getAttached: ()=>Tr,
        lorocounter_getShallowValue: ()=>Er,
        lorocounter_id: ()=>Dr,
        lorocounter_increment: ()=>Or,
        lorocounter_isAttached: ()=>kr,
        lorocounter_kind: ()=>Ar,
        lorocounter_new: ()=>jr,
        lorocounter_parent: ()=>Mr,
        lorocounter_subscribe: ()=>Nr,
        lorocounter_toJSON: ()=>_c,
        lorocounter_value: ()=>vc,
        lorodoc_JSONPath: ()=>Pr,
        lorodoc_applyDiff: ()=>Fr,
        lorodoc_attach: ()=>Ir,
        lorodoc_changeCount: ()=>Lr,
        lorodoc_checkout: ()=>Rr,
        lorodoc_checkoutToLatest: ()=>zr,
        lorodoc_clearNextCommitOptions: ()=>Br,
        lorodoc_cmpFrontiers: ()=>Vr,
        lorodoc_cmpWithFrontiers: ()=>Hr,
        lorodoc_commit: ()=>Ur,
        lorodoc_configDefaultTextStyle: ()=>Wr,
        lorodoc_configTextStyle: ()=>Gr,
        lorodoc_debugHistory: ()=>Kr,
        lorodoc_deleteRootContainer: ()=>qr,
        lorodoc_detach: ()=>Jr,
        lorodoc_diff: ()=>Yr,
        lorodoc_export: ()=>Xr,
        lorodoc_exportJsonInIdSpan: ()=>Zr,
        lorodoc_exportJsonUpdates: ()=>Qr,
        lorodoc_findIdSpansBetween: ()=>$r,
        lorodoc_fork: ()=>ei,
        lorodoc_forkAt: ()=>ti,
        lorodoc_fromSnapshot: ()=>ni,
        lorodoc_frontiers: ()=>ri,
        lorodoc_frontiersToVV: ()=>ii,
        lorodoc_getAllChanges: ()=>ai,
        lorodoc_getByPath: ()=>oi,
        lorodoc_getChangeAt: ()=>si,
        lorodoc_getChangeAtLamport: ()=>ci,
        lorodoc_getChangedContainersIn: ()=>li,
        lorodoc_getContainerById: ()=>ui,
        lorodoc_getCounter: ()=>di,
        lorodoc_getCursorPos: ()=>fi,
        lorodoc_getDeepValueWithID: ()=>pi,
        lorodoc_getList: ()=>mi,
        lorodoc_getMap: ()=>hi,
        lorodoc_getMovableList: ()=>gi,
        lorodoc_getOpsInChange: ()=>_i,
        lorodoc_getPathToContainer: ()=>vi,
        lorodoc_getPendingTxnLength: ()=>yi,
        lorodoc_getShallowValue: ()=>bi,
        lorodoc_getText: ()=>xi,
        lorodoc_getTree: ()=>Si,
        lorodoc_getUncommittedOpsAsJson: ()=>Ci,
        lorodoc_hasContainer: ()=>wi,
        lorodoc_import: ()=>Ti,
        lorodoc_importBatch: ()=>Ei,
        lorodoc_importJsonUpdates: ()=>Di,
        lorodoc_importUpdateBatch: ()=>hc,
        lorodoc_isDetached: ()=>Oi,
        lorodoc_isDetachedEditingEnabled: ()=>ki,
        lorodoc_isShallow: ()=>Ai,
        lorodoc_new: ()=>ji,
        lorodoc_opCount: ()=>Mi,
        lorodoc_oplogFrontiers: ()=>Ni,
        lorodoc_oplogVersion: ()=>Pi,
        lorodoc_peerId: ()=>Fi,
        lorodoc_peerIdStr: ()=>Ii,
        lorodoc_revertTo: ()=>Li,
        lorodoc_setChangeMergeInterval: ()=>Ri,
        lorodoc_setDetachedEditing: ()=>zi,
        lorodoc_setHideEmptyRootContainers: ()=>Bi,
        lorodoc_setNextCommitMessage: ()=>Vi,
        lorodoc_setNextCommitOptions: ()=>Hi,
        lorodoc_setNextCommitOrigin: ()=>Ui,
        lorodoc_setNextCommitTimestamp: ()=>Wi,
        lorodoc_setPeerId: ()=>Gi,
        lorodoc_setRecordTimestamp: ()=>Ki,
        lorodoc_shallowSinceFrontiers: ()=>qi,
        lorodoc_shallowSinceVV: ()=>Ji,
        lorodoc_subscribe: ()=>Yi,
        lorodoc_subscribeFirstCommitFromPeer: ()=>Xi,
        lorodoc_subscribeJsonpath: ()=>Zi,
        lorodoc_subscribeLocalUpdates: ()=>Qi,
        lorodoc_subscribePreCommit: ()=>$i,
        lorodoc_toJSON: ()=>ea,
        lorodoc_travelChangeAncestors: ()=>ta,
        lorodoc_version: ()=>na,
        lorodoc_vvToFrontiers: ()=>ra,
        lorolist_clear: ()=>ia,
        lorolist_delete: ()=>aa,
        lorolist_get: ()=>oa,
        lorolist_getAttached: ()=>sa,
        lorolist_getCursor: ()=>ca,
        lorolist_getIdAt: ()=>la,
        lorolist_getShallowValue: ()=>ua,
        lorolist_id: ()=>da,
        lorolist_insert: ()=>fa,
        lorolist_insertContainer: ()=>pa,
        lorolist_isAttached: ()=>ma,
        lorolist_isDeleted: ()=>ha,
        lorolist_kind: ()=>ga,
        lorolist_length: ()=>_a,
        lorolist_new: ()=>va,
        lorolist_parent: ()=>ya,
        lorolist_pop: ()=>ba,
        lorolist_push: ()=>xa,
        lorolist_pushContainer: ()=>Sa,
        lorolist_subscribe: ()=>Ca,
        lorolist_toArray: ()=>wa,
        lorolist_toJSON: ()=>Ta,
        loromap_clear: ()=>Ea,
        loromap_delete: ()=>Da,
        loromap_entries: ()=>Oa,
        loromap_get: ()=>ka,
        loromap_getAttached: ()=>Aa,
        loromap_getLastEditor: ()=>ja,
        loromap_getOrCreateContainer: ()=>Ma,
        loromap_getShallowValue: ()=>Na,
        loromap_id: ()=>Pa,
        loromap_isAttached: ()=>Fa,
        loromap_isDeleted: ()=>Ia,
        loromap_keys: ()=>La,
        loromap_kind: ()=>Ra,
        loromap_new: ()=>za,
        loromap_parent: ()=>Ba,
        loromap_set: ()=>Va,
        loromap_setContainer: ()=>Ha,
        loromap_size: ()=>Ua,
        loromap_subscribe: ()=>Wa,
        loromap_toJSON: ()=>Ga,
        loromap_values: ()=>Ka,
        loromovablelist_clear: ()=>qa,
        loromovablelist_delete: ()=>Ja,
        loromovablelist_get: ()=>Ya,
        loromovablelist_getAttached: ()=>Xa,
        loromovablelist_getCreatorAt: ()=>Za,
        loromovablelist_getCursor: ()=>Qa,
        loromovablelist_getLastEditorAt: ()=>$a,
        loromovablelist_getLastMoverAt: ()=>eo,
        loromovablelist_getShallowValue: ()=>to,
        loromovablelist_id: ()=>no,
        loromovablelist_insert: ()=>ro,
        loromovablelist_insertContainer: ()=>io,
        loromovablelist_isAttached: ()=>ao,
        loromovablelist_isDeleted: ()=>oo,
        loromovablelist_kind: ()=>so,
        loromovablelist_length: ()=>co,
        loromovablelist_move: ()=>lo,
        loromovablelist_new: ()=>uo,
        loromovablelist_parent: ()=>fo,
        loromovablelist_pop: ()=>po,
        loromovablelist_push: ()=>mo,
        loromovablelist_pushContainer: ()=>ho,
        loromovablelist_set: ()=>go,
        loromovablelist_setContainer: ()=>_o,
        loromovablelist_subscribe: ()=>vo,
        loromovablelist_toArray: ()=>yo,
        loromovablelist_toJSON: ()=>bo,
        lorotext_applyDelta: ()=>xo,
        lorotext_charAt: ()=>So,
        lorotext_convertPos: ()=>Co,
        lorotext_delete: ()=>wo,
        lorotext_deleteUtf8: ()=>To,
        lorotext_getAttached: ()=>Eo,
        lorotext_getCursor: ()=>Do,
        lorotext_getEditorOf: ()=>Oo,
        lorotext_getShallowValue: ()=>ko,
        lorotext_id: ()=>Ao,
        lorotext_insert: ()=>jo,
        lorotext_insertUtf8: ()=>Mo,
        lorotext_isAttached: ()=>No,
        lorotext_isDeleted: ()=>Po,
        lorotext_iter: ()=>Fo,
        lorotext_kind: ()=>Io,
        lorotext_length: ()=>Lo,
        lorotext_mark: ()=>Ro,
        lorotext_new: ()=>zo,
        lorotext_parent: ()=>Bo,
        lorotext_push: ()=>Vo,
        lorotext_slice: ()=>Ho,
        lorotext_sliceDelta: ()=>Uo,
        lorotext_sliceDeltaUtf8: ()=>Wo,
        lorotext_splice: ()=>Go,
        lorotext_subscribe: ()=>Ko,
        lorotext_toDelta: ()=>qo,
        lorotext_toJSON: ()=>Jo,
        lorotext_toString: ()=>Yo,
        lorotext_unmark: ()=>Xo,
        lorotext_update: ()=>Zo,
        lorotext_updateByLine: ()=>Qo,
        lorotree_createNode: ()=>$o,
        lorotree_delete: ()=>es,
        lorotree_disableFractionalIndex: ()=>ts,
        lorotree_enableFractionalIndex: ()=>ns,
        lorotree_getAttached: ()=>rs,
        lorotree_getNodeByID: ()=>is,
        lorotree_getNodes: ()=>as,
        lorotree_getShallowValue: ()=>os,
        lorotree_has: ()=>ss,
        lorotree_id: ()=>cs,
        lorotree_isAttached: ()=>ls,
        lorotree_isDeleted: ()=>us,
        lorotree_isFractionalIndexEnabled: ()=>ds,
        lorotree_isNodeDeleted: ()=>fs,
        lorotree_kind: ()=>ps,
        lorotree_move: ()=>ms,
        lorotree_new: ()=>hs,
        lorotree_nodes: ()=>gs,
        lorotree_parent: ()=>_s,
        lorotree_roots: ()=>vs,
        lorotree_subscribe: ()=>ys,
        lorotree_toArray: ()=>bs,
        lorotree_toJSON: ()=>xs,
        lorotreenode___getClassname: ()=>Ss,
        lorotreenode_children: ()=>Cs,
        lorotreenode_createNode: ()=>ws,
        lorotreenode_creationId: ()=>Ts,
        lorotreenode_creator: ()=>Es,
        lorotreenode_data: ()=>Ds,
        lorotreenode_fractionalIndex: ()=>Os,
        lorotreenode_getLastMoveId: ()=>ks,
        lorotreenode_id: ()=>As,
        lorotreenode_index: ()=>js,
        lorotreenode_isDeleted: ()=>Ms,
        lorotreenode_move: ()=>Ns,
        lorotreenode_moveAfter: ()=>Ps,
        lorotreenode_moveBefore: ()=>Fs,
        lorotreenode_parent: ()=>Is,
        lorotreenode_toJSON: ()=>Ls,
        memory: ()=>Tn,
        redactJsonUpdates: ()=>Rs,
        run: ()=>zs,
        setDebug: ()=>Bs,
        undomanager_addExcludeOriginPrefix: ()=>Vs,
        undomanager_canRedo: ()=>Hs,
        undomanager_canUndo: ()=>Us,
        undomanager_clear: ()=>Ws,
        undomanager_clearRedo: ()=>Gs,
        undomanager_clearUndo: ()=>Ks,
        undomanager_groupEnd: ()=>qs,
        undomanager_groupStart: ()=>Js,
        undomanager_new: ()=>Ys,
        undomanager_peer: ()=>Xs,
        undomanager_redo: ()=>Zs,
        undomanager_setMaxUndoSteps: ()=>Qs,
        undomanager_setMergeInterval: ()=>$s,
        undomanager_setOnPop: ()=>ec,
        undomanager_setOnPush: ()=>$,
        undomanager_topRedoValue: ()=>tc,
        undomanager_topUndoValue: ()=>nc,
        undomanager_undo: ()=>rc,
        versionvector_compare: ()=>ic,
        versionvector_decode: ()=>ac,
        versionvector_encode: ()=>oc,
        versionvector_get: ()=>sc,
        versionvector_length: ()=>cc,
        versionvector_new: ()=>lc,
        versionvector_parseJSON: ()=>uc,
        versionvector_remove: ()=>dc,
        versionvector_setEnd: ()=>fc,
        versionvector_setLast: ()=>pc,
        versionvector_toJSON: ()=>mc
    });
    URL = globalThis.URL;
    ({ memory: Tn, LORO_VERSION: En, __wbg_awarenesswasm_free: Dn, __wbg_changemodifier_free: On, __wbg_cursor_free: kn, __wbg_ephemeralstorewasm_free: An, __wbg_lorocounter_free: jn, __wbg_lorodoc_free: Mn, __wbg_lorolist_free: Nn, __wbg_loromap_free: Pn, __wbg_lorotext_free: Fn, __wbg_lorotree_free: In, __wbg_lorotreenode_free: Ln, __wbg_undomanager_free: Rn, __wbg_versionvector_free: zn, awarenesswasm_apply: Bn, awarenesswasm_encode: Vn, awarenesswasm_encodeAll: Hn, awarenesswasm_getAllStates: Un, awarenesswasm_getState: Wn, awarenesswasm_getTimestamp: Gn, awarenesswasm_isEmpty: Kn, awarenesswasm_length: qn, awarenesswasm_new: Jn, awarenesswasm_peer: Yn, awarenesswasm_peers: Xn, awarenesswasm_removeOutdated: Zn, awarenesswasm_setLocalState: Qn, callPendingEvents: $n, changemodifier_setMessage: er, changemodifier_setTimestamp: tr, cursor_containerId: nr, cursor_decode: rr, cursor_encode: ir, cursor_kind: ar, cursor_pos: or, cursor_side: sr, decodeFrontiers: cr, decodeImportBlobMeta: lr, encodeFrontiers: ur, ephemeralstorewasm_apply: dr, ephemeralstorewasm_delete: fr, ephemeralstorewasm_encode: pr, ephemeralstorewasm_encodeAll: mr, ephemeralstorewasm_get: hr, ephemeralstorewasm_getAllStates: gr, ephemeralstorewasm_isEmpty: _r, ephemeralstorewasm_keys: vr, ephemeralstorewasm_new: yr, ephemeralstorewasm_removeOutdated: br, ephemeralstorewasm_set: xr, ephemeralstorewasm_subscribe: Sr, ephemeralstorewasm_subscribeLocalUpdates: Cr, lorocounter_decrement: wr, lorocounter_getAttached: Tr, lorocounter_getShallowValue: Er, lorocounter_id: Dr, lorocounter_increment: Or, lorocounter_isAttached: kr, lorocounter_kind: Ar, lorocounter_new: jr, lorocounter_parent: Mr, lorocounter_subscribe: Nr, lorodoc_JSONPath: Pr, lorodoc_applyDiff: Fr, lorodoc_attach: Ir, lorodoc_changeCount: Lr, lorodoc_checkout: Rr, lorodoc_checkoutToLatest: zr, lorodoc_clearNextCommitOptions: Br, lorodoc_cmpFrontiers: Vr, lorodoc_cmpWithFrontiers: Hr, lorodoc_commit: Ur, lorodoc_configDefaultTextStyle: Wr, lorodoc_configTextStyle: Gr, lorodoc_debugHistory: Kr, lorodoc_deleteRootContainer: qr, lorodoc_detach: Jr, lorodoc_diff: Yr, lorodoc_export: Xr, lorodoc_exportJsonInIdSpan: Zr, lorodoc_exportJsonUpdates: Qr, lorodoc_findIdSpansBetween: $r, lorodoc_fork: ei, lorodoc_forkAt: ti, lorodoc_fromSnapshot: ni, lorodoc_frontiers: ri, lorodoc_frontiersToVV: ii, lorodoc_getAllChanges: ai, lorodoc_getByPath: oi, lorodoc_getChangeAt: si, lorodoc_getChangeAtLamport: ci, lorodoc_getChangedContainersIn: li, lorodoc_getContainerById: ui, lorodoc_getCounter: di, lorodoc_getCursorPos: fi, lorodoc_getDeepValueWithID: pi, lorodoc_getList: mi, lorodoc_getMap: hi, lorodoc_getMovableList: gi, lorodoc_getOpsInChange: _i, lorodoc_getPathToContainer: vi, lorodoc_getPendingTxnLength: yi, lorodoc_getShallowValue: bi, lorodoc_getText: xi, lorodoc_getTree: Si, lorodoc_getUncommittedOpsAsJson: Ci, lorodoc_hasContainer: wi, lorodoc_import: Ti, lorodoc_importBatch: Ei, lorodoc_importJsonUpdates: Di, lorodoc_isDetached: Oi, lorodoc_isDetachedEditingEnabled: ki, lorodoc_isShallow: Ai, lorodoc_new: ji, lorodoc_opCount: Mi, lorodoc_oplogFrontiers: Ni, lorodoc_oplogVersion: Pi, lorodoc_peerId: Fi, lorodoc_peerIdStr: Ii, lorodoc_revertTo: Li, lorodoc_setChangeMergeInterval: Ri, lorodoc_setDetachedEditing: zi, lorodoc_setHideEmptyRootContainers: Bi, lorodoc_setNextCommitMessage: Vi, lorodoc_setNextCommitOptions: Hi, lorodoc_setNextCommitOrigin: Ui, lorodoc_setNextCommitTimestamp: Wi, lorodoc_setPeerId: Gi, lorodoc_setRecordTimestamp: Ki, lorodoc_shallowSinceFrontiers: qi, lorodoc_shallowSinceVV: Ji, lorodoc_subscribe: Yi, lorodoc_subscribeFirstCommitFromPeer: Xi, lorodoc_subscribeJsonpath: Zi, lorodoc_subscribeLocalUpdates: Qi, lorodoc_subscribePreCommit: $i, lorodoc_toJSON: ea, lorodoc_travelChangeAncestors: ta, lorodoc_version: na, lorodoc_vvToFrontiers: ra, lorolist_clear: ia, lorolist_delete: aa, lorolist_get: oa, lorolist_getAttached: sa, lorolist_getCursor: ca, lorolist_getIdAt: la, lorolist_getShallowValue: ua, lorolist_id: da, lorolist_insert: fa, lorolist_insertContainer: pa, lorolist_isAttached: ma, lorolist_isDeleted: ha, lorolist_kind: ga, lorolist_length: _a, lorolist_new: va, lorolist_parent: ya, lorolist_pop: ba, lorolist_push: xa, lorolist_pushContainer: Sa, lorolist_subscribe: Ca, lorolist_toArray: wa, lorolist_toJSON: Ta, loromap_clear: Ea, loromap_delete: Da, loromap_entries: Oa, loromap_get: ka, loromap_getAttached: Aa, loromap_getLastEditor: ja, loromap_getOrCreateContainer: Ma, loromap_getShallowValue: Na, loromap_id: Pa, loromap_isAttached: Fa, loromap_isDeleted: Ia, loromap_keys: La, loromap_kind: Ra, loromap_new: za, loromap_parent: Ba, loromap_set: Va, loromap_setContainer: Ha, loromap_size: Ua, loromap_subscribe: Wa, loromap_toJSON: Ga, loromap_values: Ka, loromovablelist_clear: qa, loromovablelist_delete: Ja, loromovablelist_get: Ya, loromovablelist_getAttached: Xa, loromovablelist_getCreatorAt: Za, loromovablelist_getCursor: Qa, loromovablelist_getLastEditorAt: $a, loromovablelist_getLastMoverAt: eo, loromovablelist_getShallowValue: to, loromovablelist_id: no, loromovablelist_insert: ro, loromovablelist_insertContainer: io, loromovablelist_isAttached: ao, loromovablelist_isDeleted: oo, loromovablelist_kind: so, loromovablelist_length: co, loromovablelist_move: lo, loromovablelist_new: uo, loromovablelist_parent: fo, loromovablelist_pop: po, loromovablelist_push: mo, loromovablelist_pushContainer: ho, loromovablelist_set: go, loromovablelist_setContainer: _o, loromovablelist_subscribe: vo, loromovablelist_toArray: yo, loromovablelist_toJSON: bo, lorotext_applyDelta: xo, lorotext_charAt: So, lorotext_convertPos: Co, lorotext_delete: wo, lorotext_deleteUtf8: To, lorotext_getAttached: Eo, lorotext_getCursor: Do, lorotext_getEditorOf: Oo, lorotext_getShallowValue: ko, lorotext_id: Ao, lorotext_insert: jo, lorotext_insertUtf8: Mo, lorotext_isAttached: No, lorotext_isDeleted: Po, lorotext_iter: Fo, lorotext_kind: Io, lorotext_length: Lo, lorotext_mark: Ro, lorotext_new: zo, lorotext_parent: Bo, lorotext_push: Vo, lorotext_slice: Ho, lorotext_sliceDelta: Uo, lorotext_sliceDeltaUtf8: Wo, lorotext_splice: Go, lorotext_subscribe: Ko, lorotext_toDelta: qo, lorotext_toJSON: Jo, lorotext_toString: Yo, lorotext_unmark: Xo, lorotext_update: Zo, lorotext_updateByLine: Qo, lorotree_createNode: $o, lorotree_delete: es, lorotree_disableFractionalIndex: ts, lorotree_enableFractionalIndex: ns, lorotree_getAttached: rs, lorotree_getNodeByID: is, lorotree_getNodes: as, lorotree_getShallowValue: os, lorotree_has: ss, lorotree_id: cs, lorotree_isAttached: ls, lorotree_isDeleted: us, lorotree_isFractionalIndexEnabled: ds, lorotree_isNodeDeleted: fs, lorotree_kind: ps, lorotree_move: ms, lorotree_new: hs, lorotree_nodes: gs, lorotree_parent: _s, lorotree_roots: vs, lorotree_subscribe: ys, lorotree_toArray: bs, lorotree_toJSON: xs, lorotreenode___getClassname: Ss, lorotreenode_children: Cs, lorotreenode_createNode: ws, lorotreenode_creationId: Ts, lorotreenode_creator: Es, lorotreenode_data: Ds, lorotreenode_fractionalIndex: Os, lorotreenode_getLastMoveId: ks, lorotreenode_id: As, lorotreenode_index: js, lorotreenode_isDeleted: Ms, lorotreenode_move: Ns, lorotreenode_moveAfter: Ps, lorotreenode_moveBefore: Fs, lorotreenode_parent: Is, lorotreenode_toJSON: Ls, redactJsonUpdates: Rs, run: zs, setDebug: Bs, undomanager_addExcludeOriginPrefix: Vs, undomanager_canRedo: Hs, undomanager_canUndo: Us, undomanager_clear: Ws, undomanager_clearRedo: Gs, undomanager_clearUndo: Ks, undomanager_groupEnd: qs, undomanager_groupStart: Js, undomanager_new: Ys, undomanager_peer: Xs, undomanager_redo: Zs, undomanager_setMaxUndoSteps: Qs, undomanager_setMergeInterval: $s, undomanager_setOnPop: ec, undomanager_setOnPush: $, undomanager_topRedoValue: tc, undomanager_topUndoValue: nc, undomanager_undo: rc, versionvector_compare: ic, versionvector_decode: ac, versionvector_encode: oc, versionvector_get: sc, versionvector_length: cc, versionvector_new: lc, versionvector_parseJSON: uc, versionvector_remove: dc, versionvector_setEnd: fc, versionvector_setLast: pc, versionvector_toJSON: mc, lorodoc_importUpdateBatch: hc, __wbg_loromovablelist_free: gc, lorocounter_toJSON: _c, lorocounter_value: vc, __wbindgen_malloc: yc, __wbindgen_realloc: bc, __wbindgen_exn_store: xc, __wbindgen_free: Sc, __wbindgen_export_4: Cc, __wbindgen_add_to_stack_pointer: wc, _dyn_core__ops__function__FnMut__A____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__h23bd7b34cf0bced7: Tc, _dyn_core__ops__function__FnMut_____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__hd82b624f21a7fa96: Ec, __wbindgen_start: Dc } = await n({
        "./loro_wasm_bg.js": {
            __wbindgen_object_drop_ref: vn,
            __wbg_lorotext_new: it,
            __wbg_lorotreenode_new: ot,
            __wbg_lorotree_new: at,
            __wbg_lorolist_new: tt,
            __wbg_loromap_new: nt,
            __wbg_cursor_new: ke,
            __wbg_loromovablelist_new: rt,
            __wbg_lorocounter_new: et,
            __wbg_changemodifier_new: De,
            __wbg_versionvector_new: Wt,
            __wbindgen_is_function: sn,
            __wbindgen_number_get: hn,
            __wbindgen_string_get: bn,
            __wbindgen_string_new: xn,
            __wbindgen_boolean_get: Xt,
            __wbindgen_error_new: tn,
            __wbindgen_object_clone_ref: _n,
            __wbg_error_fd027616b8006afa: Pe,
            __wbindgen_cb_drop: Zt,
            __wbindgen_is_undefined: dn,
            __wbindgen_in: nn,
            __wbindgen_is_bigint: an,
            __wbindgen_bigint_from_i64: qt,
            __wbindgen_jsval_eq: fn,
            __wbindgen_is_object: ln,
            __wbindgen_bigint_from_u64: Jt,
            __wbindgen_as_number: Kt,
            __wbindgen_number_new: gn,
            __wbindgen_is_string: un,
            __wbindgen_is_null: cn,
            __wbindgen_is_falsy: on,
            __wbindgen_typeof: Cn,
            __wbg_warn_5cdab1103c5473b2: Gt,
            __wbg_log_62fc5f7c674bfa10: Qe,
            __wbindgen_is_array: rn,
            __wbg_log_cb9e190acc5753fb: $e,
            __wbg_log_0cc1b7768397bcfe: Ze,
            __wbg_mark_7438147ce31e9d4b: st,
            __wbg_measure_fb7825c11612c823: ct,
            __wbg_new_8a6f238a6ece86ea: pt,
            __wbg_stack_0ed75d68575b0f3c: Ft,
            __wbg_error_7534b8e9a36f1ab4: Ne,
            __wbindgen_jsval_loose_eq: pn,
            __wbg_getwithrefkey_1dc361bd10053bfe: Ve,
            __wbg_set_3f1d0b984ed272ed: At,
            __wbg_String_8f0eb39a4a4c2f66: ye,
            __wbg_now_6727e3e536e11536: St,
            __wbg_crypto_574e78ad8b13b65f: Oe,
            __wbg_process_dc0fbacc7c1c06f7: wt,
            __wbg_versions_c01dfd4722a88165: Ut,
            __wbg_node_905d3e251edff8a2: xt,
            __wbg_require_60cc747a6bc5215a: Dt,
            __wbg_msCrypto_a61aeb35a24c1329: lt,
            __wbg_randomFillSync_ac0988aba3254290: Et,
            __wbg_getRandomValues_b8f5dbd5f3995a9e: Le,
            __wbg_new_5e0be73521bc8c17: dt,
            __wbg_new_78feb108b6472713: ft,
            __wbg_new_405e22f390576ce2: ut,
            __wbg_newnoargs_105ed471475aaf50: ht,
            __wbg_new_a12002a7f91c75be: mt,
            __wbg_buffer_609cc3eee51ed158: Se,
            __wbg_newwithbyteoffsetandlength_d97e637ebe145a9a: gt,
            __wbg_length_a446193dc22c12f8: Ye,
            __wbg_newwithlength_a381634e90c276d4: _t,
            __wbg_set_65595bdd868b3009: jt,
            __wbg_subarray_aa9065fa9dc5df96: Bt,
            __wbg_getindex_5b00c274b05714aa: Be,
            __wbg_setindex_dcd71eabf405bde1: Pt,
            __wbg_done_769e5ede4b31c67b: Ae,
            __wbg_value_cd1ffa7b1ab794f1: Ht,
            __wbg_instanceof_Map_f3469ce2244d2430: Ue,
            __wbg_instanceof_Object_7f2dcef8f78644a4: We,
            __wbg_instanceof_Uint8Array_17156bcf118086a9: Ge,
            __wbg_instanceof_ArrayBuffer_e14585432e3737fc: He,
            __wbg_set_8fc6bf8a5b1071d1: Mt,
            __wbg_entries_c8a90a7ed73e84ce: Me,
            __wbg_newwithlength_c4c419ef0bc8a1f8: vt,
            __wbg_get_b9b93047fe3cf45b: ze,
            __wbg_set_37837023f3d740e8: kt,
            __wbg_from_2a5d3e218e67aa85: Fe,
            __wbg_length_e2d2a49132c1b256: Xe,
            __wbg_push_737cfc8c1432c2c6: Tt,
            __wbg_isArray_a1eab7e0d067391b: Ke,
            __wbg_isSafeInteger_343e2beeeece1bb0: qe,
            __wbg_getOwnPropertySymbols_97eebed6fe6e08be: Ie,
            __wbg_entries_3265d4158b33e5dc: je,
            __wbg_iterator_9a24c88df860dc65: Je,
            __wbg_static_accessor_GLOBAL_THIS_56578be7e9f832b0: Lt,
            __wbg_call_672a4d21634d4a24: Ce,
            __wbg_static_accessor_SELF_37c5d418e4bf5819: Rt,
            __wbg_static_accessor_GLOBAL_88a902d13a557d07: It,
            __wbg_static_accessor_WINDOW_5de37043a91a9c40: zt,
            __wbg_then_44b73946d2fb3e7d: Vt,
            __wbg_resolve_4851785c9c5f573d: Ot,
            __wbg_get_67b2ba62fc30de12: Re,
            __wbg_set_bb8cecf6a62b9f46: Nt,
            __wbg_apply_eb9e9b97497f91e4: xe,
            __wbg_ownKeys_3930041068756f1f: Ct,
            __wbg_apply_36be6a55257c99bf: be,
            __wbg_call_7cccdd69e0791ae2: we,
            __wbg_call_833bed5770ea2041: Te,
            __wbg_call_b8adc8b1d0a0d8eb: Ee,
            __wbg_next_25feadfc0913fea9: yt,
            __wbg_next_6574e1a8a62d1055: bt,
            __wbindgen_bigint_get_as_i64: Yt,
            __wbindgen_memory: mn,
            __wbindgen_throw: Sn,
            __wbindgen_rethrow: yn,
            __wbindgen_debug_string: en,
            __wbindgen_closure_wrapper746: Qt,
            __wbindgen_closure_wrapper748: $t
        }
    }, t));
})();
export { mr as $, lc as $a, ds as $i, ua as $n, uo as $r, di as $t, Gn as A, Vs as Aa, Ho as Ai, Vi as An, Va as Ar, Hr as At, tr as B, Zs as Ba, Qo as Bi, Zi as Bn, Za as Br, Qr as Bt, Tc as C, Fs as Ca, Fo as Ci, Pi as Cn, Pa as Cr, Fr as Ct, Hn as D, Rs as Da, zo as Di, Ri as Dn, Ra as Dr, zr as Dt, Vn as E, Tn as Ea, Ro as Ei, Li as En, La as Er, Rr as Et, Xn as F, Ks as Fa, qo as Fi, Ki as Fn, Ka as Fr, qr as Ft, or as G, tc as Ga, rs as Gi, na as Gn, no as Gr, ri as Gt, rr as H, $s as Ha, es as Hi, $i as Hn, $a as Hr, ei as Ht, Zn as I, qs as Ia, Jo as Ii, qi as In, qa as Ir, Jr as It, lr as J, ic as Ja, os as Ji, aa as Jn, ao as Jr, oi as Jt, sr as K, nc as Ka, is as Ki, ra as Kn, ro as Kr, ii as Kt, Qn as L, Js as La, Yo as Li, Ji as Ln, Ja as Lr, Yr as Lt, qn as M, Us as Ma, Wo as Mi, Ui as Mn, Ua as Mr, Wr as Mt, Jn as N, Ws as Na, Go as Ni, Wi as Nn, Wa as Nr, Gr as Nt, Un as O, zs as Oa, Bo as Oi, zi as On, za as Or, Br as Ot, Yn as P, Gs as Pa, Ko as Pi, Gi as Pn, Ga as Pr, Kr as Pt, pr as Q, cc as Qa, us as Qi, la as Qn, lo as Qr, ui as Qt, $n as R, Ys as Ra, Xo as Ri, Yi as Rn, Ya as Rr, Xr as Rt, Dc as S, Ps as Sa, Po as Si, Ni as Sn, Na as Sr, Pr as St, Bn as T, Ls as Ta, Lo as Ti, Ii as Tn, Ia as Tr, Lr as Tt, ir as U, ec as Ua, ts as Ui, ea as Un, eo as Ur, ti as Ut, nr as V, Qs as Va, $o as Vi, Qi as Vn, Qa as Vr, $r as Vt, ar as W, $ as Wa, ns as Wi, ta as Wn, to as Wr, ni as Wt, dr as X, oc as Xa, cs as Xi, sa as Xn, so as Xr, ci as Xt, ur as Y, ac as Ya, ss as Yi, oa as Yn, oo as Yr, si as Yt, fr as Z, sc as Za, ls as Zi, ca as Zn, co as Zr, li as Zt, xc as _, ks as _a, ko as _i, Oi as _n, Oa as _r, jr as _t, An as a, _s as aa, _o as ai, _i as an, F as ao, ga as ar, br as at, yc as b, Ms as ba, Mo as bi, ji as bn, ja as br, _c as bt, Nn as c, bs as ca, bo as ci, bi as cn, U as co, ya as cr, Cr as ct, Fn as d, Cs as da, Co as di, Ci as dn, Y as do, Sa as dr, Tr as dt, fs as ea, fo as ei, fi as en, uc as eo, da as er, hr as et, In as f, ws as fa, wo as fi, wi as fn, ve as fo, Ca as fr, Er as ft, wc as g, Os as ga, Oo as gi, hc as gn, Da as gr, Ar as gt, zn as h, Ds as ha, Do as hi, Di as hn, r as ho, Ea as hr, kr as ht, kn as i, gs as ia, go as ii, gi as in, mc as io, ha as ir, yr as it, Kn as j, Hs as ja, Uo as ji, Hi as jn, Ha as jr, Ur as jt, Wn as k, Bs as ka, Vo as ki, Bi as kn, Ba as kr, Vr as kt, Pn as l, xs as la, xo as li, xi as ln, G as lo, ba as lr, wn as lt, Rn as m, Es as ma, Eo as mi, Ei as mn, M as mo, Ta as mr, Or as mt, Dn as n, ms as na, mo as ni, mi as nn, fc as no, pa as nr, _r as nt, jn as o, vs as oa, vo as oi, vi as on, z as oo, _a as or, xr as ot, Ln as p, Ts as pa, To as pi, Ti as pn, a as po, wa as pr, Dr as pt, cr as q, rc as qa, as as qi, ia as qn, io as qr, ai as qt, On as r, hs as ra, ho as ri, hi as rn, pc as ro, ma as rr, vr as rt, Mn as s, ys as sa, yo as si, yi as sn, V as so, va as sr, Sr as st, En as t, ps as ta, po as ti, pi as tn, dc as to, fa as tr, gr as tt, gc as u, Ss as ua, So as ui, Si as un, q as uo, xa as ur, wr as ut, Cc as v, As as va, Ao as vi, ki as vn, ka as vr, Mr as vt, Ec as w, Is as wa, Io as wi, Fi as wn, Fa as wr, Ir as wt, bc as x, Ns as xa, No as xi, Mi as xn, Ma as xr, vc as xt, Sc as y, js as ya, jo as yi, Ai as yn, Aa as yr, Nr as yt, er as z, Xs as za, Zo as zi, Xi as zn, Xa as zr, Zr as zt, __tla };
