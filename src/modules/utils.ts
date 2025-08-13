import { Either, Left, Right, RulesError, UnwrapEither } from "./types";
import { getAddress as _getAddress, isAddress as _isAddress } from 'viem';
import { v4 as uuidv4 } from 'uuid';


// Get a default encoded values string from a Calling Function
export function getEncodedValues(callingFunction: string) {
    // Extract content between parentheses
    const match = callingFunction.match(/\(([^)]*)\)/);

    // Return the matched group or empty string if no match
    const encodedValues = match ? match[1] : "";
}

export const unwrapEither: UnwrapEither = <T, U>({
    left,
    right,
}: Either<T, U>) => {
    if (right !== undefined && left !== undefined) {
        throw new Error(
            `Received both left and right values at runtime when opening an Either\nLeft: ${JSON.stringify(
                left
            )}\nRight: ${JSON.stringify(right)}`
        );
        /*
         We're throwing in this function because this can only occur at runtime if something 
         happens that the TypeScript compiler couldn't anticipate. That means the application
         is in an unexpected state and we should terminate immediately.
        */
    }
    if (left !== undefined) {
        return left as NonNullable<T>; // Typescript is getting confused and returning this type as `T | undefined` unless we add the type assertion
    }
    if (right !== undefined) {
        return right as NonNullable<U>;
    }
    throw new Error(
        `Received no left or right values at runtime when opening Either`
    );
};

export const isLeft = <T, U>(e: Either<T, U>): e is Left<T> => {
    return e.left !== undefined;
};

export const isRight = <T, U>(e: Either<T, U>): e is Right<U> => {
    return e.right !== undefined;
};

export const makeLeft = <T>(value: T): Left<T> => ({ left: value });

export const makeRight = <U>(value: U): Right<U> => ({ right: value });

export const getRandom = () => uuidv4();