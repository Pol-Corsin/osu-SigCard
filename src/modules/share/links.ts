/**
 * Public URLs and embed snippets for published cards. Pure functions, safe to
 * import on the client.
 */
export type CardLinks = {
  page: string;
  image: string;
  profile: string;
};

export const OSU_PROFILE = (osuUserId: number) => `https://osu.ppy.sh/users/${osuUserId}`;

export function cardLinks(baseUrl: string, publicId: string, osuUserId: number): CardLinks {
  const base = baseUrl.replace(/\/+$/, "");
  return {
    page: `${base}/card/${publicId}`,
    image: `${base}/c/${publicId}.png`,
    profile: OSU_PROFILE(osuUserId),
  };
}

/** Private edit link. The token is in the fragment, which browsers never send to servers. */
export const editLink = (baseUrl: string, publicId: string, token: string) => `${baseUrl.replace(/\/+$/, "")}/edit/${publicId}#${token}`;

/**
 * osu! BBCode. Single line on purpose: the osu! About Me editor turns line
 * breaks into <br>, which would add empty lines around the image.
 */
export const bbcode = (profileUrl: string, imageUrl: string) => `[url=${profileUrl}][img]${imageUrl}[/img][/url]`;
