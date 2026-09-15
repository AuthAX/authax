/* eslint-disable -- legacy, pending the spike promotion */
import { invariant, isRecord } from "./lib";

/**
 * Minimal schema-based parser
 *
 * Parse, don't validate: constructs new typed objects from unknown input,
 * stripping excess properties. Throws on invalid input.
 */

type Parser<T> = (input: unknown) => T;

function str(): Parser<string> {
  return (input) => {
    if (typeof input !== "string") throw new Error("expected string");
    return input;
  };
}

function obj<T extends Record<string, Parser<unknown>>>(
  shape: T,
): Parser<{ [K in keyof T]: ReturnType<T[K]> }> {
  return (input) => {
    if (!isRecord(input)) throw new Error("expected object");

    const result = {} as { [K in keyof T]: ReturnType<T[K]> };

    for (const key in shape) {
      const parser = shape[key];

      invariant(parser, `every key in the shape has a parser, missing ${key}`);

      try {
        const parsed = parser(input[key]);
        if (parsed !== undefined) {
          result[key] = parsed as ReturnType<T[typeof key]>;
        }
      } catch (error) {
        invariant(error instanceof Error, "every parser throws an Error");

        throw new Error(`"${key}": ${error.message}`, { cause: error });
      }
    }

    return result;
  };
}

function optional<T>(parser: Parser<T>): Parser<T | undefined> {
  return (input) => (input == null ? undefined : parser(input));
}

function array<T>(parser: Parser<T>): Parser<T[]> {
  return (input) => {
    if (!Array.isArray(input)) throw new Error("expected array");
    return input.map(parser);
  };
}

function literal<const T extends string | number | boolean>(
  values: T[],
): Parser<T> {
  return (input) => {
    for (const value of values) {
      if (input === value) return value;
    }
    throw new Error(`expected one of: ${values.join(", ")}`);
  };
}

function record(): Parser<Record<string, unknown>> {
  return (input) => {
    if (!isRecord(input)) throw new Error("expected object");
    return { ...input };
  };
}

function tagged<
  TTag extends string,
  TVariants extends Record<string, Parser<object>>,
>(
  tag: TTag,
  variants: TVariants,
): Parser<
  {
    [K in keyof TVariants]: Record<TTag, K> & ReturnType<TVariants[K]>;
  }[keyof TVariants]
> {
  const validTags = Object.keys(variants);

  return (input) => {
    if (!isRecord(input)) throw new Error("expected object");

    const tagValue = input[tag];

    if (typeof tagValue !== "string") {
      throw new Error(`expected "${tag}" to be a string`);
    }

    const parser = variants[tagValue];
    if (!parser) {
      throw new Error(
        `expected "${tag}" to be one of: ${validTags.join(", ")}`,
      );
    }

    const parsed = parser(input);
    return { ...parsed, [tag]: tagValue } as {
      [K in keyof TVariants]: Record<TTag, K> & ReturnType<TVariants[K]>;
    }[keyof TVariants];
  };
}

export const p = { str, obj, optional, array, literal, record, tagged };
