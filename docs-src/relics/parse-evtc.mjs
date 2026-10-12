// Relic analyzer logic, from the TypeScript original with only the types removed. Inlined into docs/index.html by scripts/build_docs.js
// https://www.deltaconnected.com/arcdps/evtc/README.txt
// https://github.com/baaron4/GW2-Elite-Insights-Parser/blob/master/GW2EI.Library/GW2EI.Services/GW2EIEvtcParser/EvtcParser.cs
export const AGENT_SIZE = 96;
export const EVENT_SIZE = 64;
export const HEADER_SIZE = 16;
export const SKILL_SIZE = 68;
// From this arcdps build, buff applies/removes are state changes and damage results use a new enum
export const EVTC_BUILD_STATE_CHANGE_REWORK = 20260501;
export const decoder = new TextDecoder();
// .zevtc files are zip archives holding a single .evtc entry
export async function unzip(buffer) {
    const view = new DataView(buffer);
    if (view.getUint32(0, true) !== 0x04034b50)
        return buffer;
    let endOfCentralDirectory = buffer.byteLength - 22;
    while (endOfCentralDirectory >= 0 && view.getUint32(endOfCentralDirectory, true) !== 0x06054b50) {
        endOfCentralDirectory--;
    }
    if (endOfCentralDirectory < 0)
        throw new Error('Invalid zip archive.');
    const centralDirectory = view.getUint32(endOfCentralDirectory + 16, true);
    const compressedSize = view.getUint32(centralDirectory + 20, true);
    const method = view.getUint16(centralDirectory + 10, true);
    const localHeader = view.getUint32(centralDirectory + 42, true);
    const dataStart = localHeader + 30 + view.getUint16(localHeader + 26, true) + view.getUint16(localHeader + 28, true);
    const data = new Uint8Array(buffer, dataStart, compressedSize);
    if (method === 0)
        return data.slice().buffer;
    if (method !== 8)
        throw new Error(`Unsupported zip compression method ${method}.`);
    return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
}
export default async function parseEvtc(file) {
    const buffer = await unzip(await file.arrayBuffer());
    const bytes = new Uint8Array(buffer);
    if (decoder.decode(bytes.subarray(0, 4)) !== 'EVTC')
        throw new Error('Not an EVTC file.');
    const view = new DataView(buffer);
    const revision = view.getUint8(12);
    if (revision !== 1)
        throw new Error(`Unsupported EVTC revision ${revision}.`);
    const bossId = view.getUint16(13, true);
    const build = Number(decoder.decode(bytes.subarray(4, 12)));
    const agentCount = view.getUint32(HEADER_SIZE, true);
    const agentsStart = HEADER_SIZE + 4;
    const agents = Array.from({ length: agentCount }, (_, i) => {
        const offset = agentsStart + i * AGENT_SIZE;
        return {
            address: view.getBigUint64(offset, true),
            elite: view.getUint32(offset + 12, true),
            name: decoder.decode(bytes.subarray(offset + 28, offset + AGENT_SIZE)),
            prof: view.getUint32(offset + 8, true),
        };
    });
    const skillsStart = agentsStart + agentCount * AGENT_SIZE;
    const skillCount = view.getUint32(skillsStart, true);
    const eventsStart = skillsStart + 4 + skillCount * SKILL_SIZE;
    const eventCount = Math.floor((buffer.byteLength - eventsStart) / EVENT_SIZE);
    const getTime = (i) => Number(view.getBigInt64(eventsStart + i * EVENT_SIZE, true));
    return {
        agents,
        bossId,
        build,
        duration: eventCount
            ? getTime(eventCount - 1) - getTime(0)
            : 0,
        events: function* (filter) {
            for (let i = 0; i < eventCount; i++) {
                const offset = eventsStart + i * EVENT_SIZE;
                const skillId = view.getUint32(offset + 36, true);
                if (!filter(skillId))
                    continue;
                yield {
                    buff: view.getUint8(offset + 49),
                    buffDmg: view.getInt32(offset + 28, true),
                    dstAgent: view.getBigUint64(offset + 16, true),
                    isActivation: view.getUint8(offset + 51),
                    isBuffRemove: view.getUint8(offset + 52),
                    isOffcycle: view.getUint8(offset + 59),
                    isStateChange: view.getUint8(offset + 56),
                    pad: view.getUint32(offset + 60, true),
                    result: view.getUint8(offset + 50),
                    skillId,
                    srcAgent: view.getBigUint64(offset + 8, true),
                    time: Number(view.getBigInt64(offset, true)),
                    value: view.getInt32(offset + 24, true),
                    x: view.getFloat32(offset + 16, true),
                    y: view.getFloat32(offset + 20, true),
                };
            }
        },
    };
}
